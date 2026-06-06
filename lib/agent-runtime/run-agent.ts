import {
  buildModelAuditRecord,
  createAuditRunId,
  elapsedMs,
  InMemoryAuditSink,
  nowIso,
  type AgentAuditSnapshot,
  type AuditSink,
} from "./audit";
import { AgentRuntimeError, toDiagnosticError, type DiagnosticError, type RuntimeAgentKey } from "./errors";
import type { JsonSchema, SchemaValidationResult } from "./schemas";
import { createResponseTextFormat, parseJsonObject, validateJsonSchema } from "./schemas";
import type { AgentTool, ToolCallRequest } from "./tool-runner";
import { executeAllowedTool, toOpenAIToolDefinitions } from "./tool-runner";

// "live" is the only production mode; "fixture" exists for tests and replay only.
export type AgentRunMode = "fixture" | "live";

export interface AgentSkill {
  name: string;
  role: string;
  instructions: string;
  version: string;
  policies?: string[];
  scoringRules?: string[];
}

export interface OpenAIResponsesClient {
  create(request: Record<string, unknown>, init?: { signal?: AbortSignal }): Promise<unknown>;
}

export interface RunAgentOptions<Input, Output> {
  agentKey: RuntimeAgentKey;
  skill: AgentSkill;
  input: Input;
  outputSchema: JsonSchema;
  outputSchemaName?: string;
  tools?: AgentTool[];
  mode: AgentRunMode;
  fixture?: Output | ((input: Input) => Promise<Output> | Output);
  model?: string;
  apiKey?: string;
  client?: OpenAIResponsesClient;
  audit?: AuditSink;
  runId?: string;
  timeoutMs?: number;
  maxToolCalls?: number;
  retryOnce?: boolean;
  metadata?: Record<string, unknown>;
}

export interface RunAgentSuccess<Output> {
  ok: true;
  run_id: string;
  agent_key: RuntimeAgentKey;
  output: Output;
  attempts: number;
  latency_ms: number;
  audit?: AgentAuditSnapshot;
}

export interface RunAgentFailure {
  ok: false;
  run_id: string;
  agent_key: RuntimeAgentKey;
  error: DiagnosticError;
  attempts: number;
  latency_ms: number;
  audit?: AgentAuditSnapshot;
}

export type RunAgentResult<Output> = RunAgentSuccess<Output> | RunAgentFailure;

export class FetchOpenAIResponsesClient implements OpenAIResponsesClient {
  private readonly apiKey: string;
  private readonly endpoint: string;

  constructor(apiKey: string, endpoint = "https://api.openai.com/v1/responses") {
    this.apiKey = apiKey;
    this.endpoint = endpoint;
  }

  async create(request: Record<string, unknown>, init: { signal?: AbortSignal } = {}): Promise<unknown> {
    const response = await fetch(this.endpoint, {
      method: "POST",
      signal: init.signal,
      headers: {
        "Authorization": `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    });

    const bodyText = await response.text();
    const body = bodyText ? parseJsonObject(bodyText).value ?? bodyText : {};

    if (!response.ok) {
      throw new AgentRuntimeError("MODEL_REQUEST_FAILED", `OpenAI Responses API failed with ${response.status}`, {
        details: { status: response.status, body },
      });
    }

    return body;
  }
}

export async function runAgent<Input, Output>(
  options: RunAgentOptions<Input, Output>,
): Promise<RunAgentResult<Output>> {
  const runId = options.runId ?? createAuditRunId("run");
  const audit = options.audit ?? new InMemoryAuditSink();
  const startedAt = nowIso();
  let attempts = 0;

  try {
    await audit.startAgent({
      runId,
      agentKey: options.agentKey,
      skillVersion: options.skill.version,
      mode: options.mode,
      input: options.input,
      metadata: options.metadata,
    });

    const output =
      options.mode === "live"
        ? await runLiveWithRetry(options, runId, audit, (value) => {
            attempts = value;
          })
        : await runFixture(options, runId, audit);

    await audit.completeAgent(runId, options.agentKey, output);
    const completedAt = nowIso();
    return {
      ok: true,
      run_id: runId,
      agent_key: options.agentKey,
      output,
      attempts: Math.max(1, attempts),
      latency_ms: elapsedMs(startedAt, completedAt),
      audit: await audit.getAgentSnapshot(runId, options.agentKey),
    };
  } catch (error) {
    const diagnostic = toDiagnosticError(error, {
      runId,
      agentKey: options.agentKey,
      message: "Agent runtime failed",
    });
    try {
      const snapshot = await audit.getAgentSnapshot(runId, options.agentKey);
      if (snapshot) {
        await audit.failAgent(runId, options.agentKey, diagnostic);
      }
    } catch {
      diagnostic.details = {
        ...(diagnostic.details ?? {}),
        audit_warning: "Failed to persist failure state after runtime error",
      };
    }
    const completedAt = nowIso();
    return {
      ok: false,
      run_id: runId,
      agent_key: options.agentKey,
      error: diagnostic,
      attempts: Math.max(1, attempts),
      latency_ms: elapsedMs(startedAt, completedAt),
      audit: await audit.getAgentSnapshot(runId, options.agentKey),
    };
  }
}

export function assertAgentSuccess<Output>(result: RunAgentResult<Output>): Output {
  if (result.ok) {
    return result.output;
  }
  throw new AgentRuntimeError(result.error.code, result.error.message, {
    runId: result.run_id,
    agentKey: result.agent_key,
    details: result.error.details,
    retryable: result.error.retryable,
  });
}

async function runFixture<Input, Output>(
  options: RunAgentOptions<Input, Output>,
  runId: string,
  audit: AuditSink,
): Promise<Output> {
  if (options.fixture === undefined) {
    throw new AgentRuntimeError("FIXTURE_NOT_FOUND", "Fixture mode requires a fixture output or fixture function", {
      runId,
      agentKey: options.agentKey,
    });
  }

  const output =
    typeof options.fixture === "function"
      ? await (options.fixture as (input: Input) => Promise<Output> | Output)(options.input)
      : options.fixture;
  const validation = validateJsonSchema(options.outputSchema, output);
  await recordSchemaResult(options, runId, audit, 1, validation);

  if (!validation.valid) {
    throw new AgentRuntimeError("SCHEMA_VALIDATION_FAILED", "Fixture output failed schema validation", {
      runId,
      agentKey: options.agentKey,
      attempt: 1,
      details: { errors: validation.errors },
      retryable: false,
    });
  }

  return output;
}

async function runLiveWithRetry<Input, Output>(
  options: RunAgentOptions<Input, Output>,
  runId: string,
  audit: AuditSink,
  setAttempts: (attempts: number) => void,
): Promise<Output> {
  const maxAttempts = options.retryOnce === false ? 1 : 2;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    setAttempts(attempt);
    try {
      return await withTimeout(
        options.timeoutMs ?? 60_000,
        (signal) => runLiveAttempt(options, runId, audit, attempt, signal),
        options.agentKey,
        runId,
        attempt,
      );
    } catch (error) {
      lastError = error;
      const diagnostic = toDiagnosticError(error, { runId, agentKey: options.agentKey, attempt });
      if (attempt >= maxAttempts || !diagnostic.retryable) {
        break;
      }
    }
  }

  throw new AgentRuntimeError("RETRY_EXHAUSTED", "Agent failed after retry budget was exhausted", {
    runId,
    agentKey: options.agentKey,
    details: { max_attempts: maxAttempts, last_error: toDiagnosticError(lastError) },
    retryable: false,
    cause: lastError,
  });
}

async function runLiveAttempt<Input, Output>(
  options: RunAgentOptions<Input, Output>,
  runId: string,
  audit: AuditSink,
  attempt: number,
  signal: AbortSignal,
): Promise<Output> {
  const model = options.model ?? readEnv("OPENAI_TEXT_MODEL") ?? readEnv("OPENAI_MODEL") ?? "gpt-5.5";
  const client = options.client ?? new FetchOpenAIResponsesClient(options.apiKey ?? readRequiredOpenAIKey());
  const tools = options.tools ?? [];
  const maxToolCalls = options.maxToolCalls ?? 8;
  const inputItems: Record<string, unknown>[] = [
    {
      role: "system",
      content: buildSystemInstructions(options.skill, attempt),
    },
    {
      role: "user",
      content: JSON.stringify(
        {
          agent_key: options.agentKey,
          input: options.input,
          output_contract: "Return only the JSON object matching the configured schema.",
        },
        null,
        2,
      ),
    },
  ];

  let toolCallCount = 0;

  while (true) {
    const request = buildResponsesRequest(options, model, inputItems, tools);
    const responseStartedAt = nowIso();
    const response = await client.create(request, { signal });
    const responseCompletedAt = nowIso();
    const responseLatencyMs = elapsedMs(responseStartedAt, responseCompletedAt);
    await audit.recordModelResponse(
      runId,
      options.agentKey,
      buildModelAuditRecord({
        id: `model_attempt_${attempt}_${Date.now()}`,
        model,
        response,
        startedAt: responseStartedAt,
        completedAt: responseCompletedAt,
        latencyMs: responseLatencyMs,
      }),
    );

    const functionCalls = extractFunctionCalls(response);
    if (functionCalls.length > 0) {
      if (toolCallCount + functionCalls.length > maxToolCalls) {
        throw new AgentRuntimeError("TOOL_EXECUTION_FAILED", "Agent exceeded max tool calls", {
          runId,
          agentKey: options.agentKey,
          attempt,
          details: { max_tool_calls: maxToolCalls },
          retryable: false,
        });
      }

      inputItems.push(...extractContinuationItems(response));

      for (const call of functionCalls) {
        toolCallCount += 1;
        const toolResult = await executeAllowedTool(call, tools, {
          runId,
          agentKey: options.agentKey,
          audit,
          signal,
          metadata: options.metadata,
        });
        inputItems.push({
          type: "function_call_output",
          call_id: call.call_id,
          output: JSON.stringify({ ok: true, data: toolResult.output }),
        });
      }
      continue;
    }

    const outputText = extractOutputText(response);
    const parsed = parseJsonObject<Output>(outputText);
    if (!parsed.ok || parsed.value === undefined) {
      throw new AgentRuntimeError("MODEL_OUTPUT_PARSE_FAILED", "Model output was not valid JSON", {
        runId,
        agentKey: options.agentKey,
        attempt,
        details: { parse_error: parsed.error, output_preview: outputText.slice(0, 500) },
      });
    }

    const validation = validateJsonSchema(options.outputSchema, parsed.value);
    await recordSchemaResult(options, runId, audit, attempt, validation);
    if (!validation.valid) {
      throw new AgentRuntimeError("SCHEMA_VALIDATION_FAILED", "Model output failed schema validation", {
        runId,
        agentKey: options.agentKey,
        attempt,
        details: { errors: validation.errors },
      });
    }

    return parsed.value;
  }
}

function buildResponsesRequest<Input, Output>(
  options: RunAgentOptions<Input, Output>,
  model: string,
  inputItems: Record<string, unknown>[],
  tools: AgentTool[],
): Record<string, unknown> {
  return {
    model,
    input: inputItems,
    tools: toOpenAIToolDefinitions(tools),
    tool_choice: tools.length ? "auto" : "none",
    parallel_tool_calls: false,
    text: createResponseTextFormat(options.outputSchemaName ?? `${options.agentKey}_output`, options.outputSchema),
    store: false,
  };
}

function buildSystemInstructions(skill: AgentSkill, attempt: number): string {
  const retryInstruction =
    attempt > 1
      ? "\nThis is a retry after validation failed. Be stricter: return one JSON object matching the schema exactly."
      : "";

  return [
    `You are ${skill.name}.`,
    `Role: ${skill.role}.`,
    skill.instructions,
    ...(skill.policies?.length ? [`Policies:\n${skill.policies.map((policy) => `- ${policy}`).join("\n")}`] : []),
    ...(skill.scoringRules?.length
      ? [`Scoring rules:\n${skill.scoringRules.map((rule) => `- ${rule}`).join("\n")}`]
      : []),
    "Use allowed tools when evidence is needed. Do not invent tool results.",
    "When finished, return only the structured JSON requested by the response format.",
    retryInstruction,
  ]
    .filter(Boolean)
    .join("\n\n");
}

function extractFunctionCalls(response: unknown): ToolCallRequest[] {
  const output = asOutputArray(response);
  return output
    .filter((item) => item.type === "function_call")
    .map((item) => ({
      id: typeof item.id === "string" ? item.id : undefined,
      call_id: typeof item.call_id === "string" ? item.call_id : undefined,
      name: String(item.name),
      arguments: item.arguments ?? {},
    }));
}

function extractContinuationItems(response: unknown): Record<string, unknown>[] {
  return asOutputArray(response);
}

function extractOutputText(response: unknown): string {
  const record = asRecord(response);
  if (typeof record.output_text === "string") {
    return record.output_text;
  }

  const parts: string[] = [];
  for (const item of asOutputArray(response)) {
    if (Array.isArray(item.content)) {
      for (const content of item.content) {
        const contentRecord = asRecord(content);
        if (typeof contentRecord.text === "string") {
          parts.push(contentRecord.text);
        }
      }
    }
  }

  return parts.join("\n");
}

async function recordSchemaResult<Input, Output>(
  options: RunAgentOptions<Input, Output>,
  runId: string,
  audit: AuditSink,
  attempt: number,
  result: SchemaValidationResult,
): Promise<void> {
  await audit.recordSchemaResult(runId, options.agentKey, {
    name: options.outputSchemaName ?? `${options.agentKey}_output`,
    attempt,
    checked_at: nowIso(),
    result,
  });
}

async function withTimeout<T>(
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>,
  agentKey: RuntimeAgentKey,
  runId: string,
  attempt: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fn(controller.signal);
  } catch (error) {
    if (controller.signal.aborted) {
      throw new AgentRuntimeError("TIMEOUT", `Agent timed out after ${timeoutMs}ms`, {
        runId,
        agentKey,
        attempt,
        details: { timeout_ms: timeoutMs },
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function readRequiredOpenAIKey(): string {
  const apiKey = readEnv("OPENAI_API_KEY");
  if (!apiKey) {
    throw new AgentRuntimeError("MODEL_REQUEST_FAILED", "OPENAI_API_KEY is required for live mode", {
      retryable: false,
    });
  }
  return apiKey;
}

function readEnv(key: string): string | undefined {
  return (globalThis as unknown as { process?: { env?: Record<string, string | undefined> } }).process?.env?.[key];
}

function asOutputArray(response: unknown): Record<string, unknown>[] {
  const output = asRecord(response).output;
  return Array.isArray(output) ? output.map(asRecord) : [];
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}
