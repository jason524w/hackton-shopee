import type { AuditSink, ToolCallAuditRecord } from "./audit";
import { nowIso, elapsedMs } from "./audit";
import { AgentRuntimeError, ensureRuntimeError, toDiagnosticError, type RuntimeAgentKey } from "./errors";
import type { JsonSchema } from "./schemas";
import { parseJsonObject, validateJsonSchema } from "./schemas";

export interface AgentTool<Input = unknown, Output = unknown> {
  name: string;
  description: string;
  parameters: JsonSchema;
  execute(input: Input, context: ToolExecutionContext): Promise<Output> | Output;
}

export interface ToolExecutionContext {
  runId: string;
  agentKey: RuntimeAgentKey;
  audit: AuditSink;
  signal?: AbortSignal;
  metadata?: Record<string, unknown>;
}

export interface ToolCallRequest {
  id?: string;
  call_id?: string;
  name: string;
  arguments: unknown;
}

export interface ToolExecutionResult {
  ok: boolean;
  tool_name: string;
  call_id?: string;
  input: unknown;
  output?: unknown;
  error?: ReturnType<typeof toDiagnosticError>;
  latency_ms: number;
}

export interface ExecuteToolOptions {
  throwOnError?: boolean;
}

export function toOpenAIToolDefinitions(tools: AgentTool[]): Record<string, unknown>[] {
  return tools.map((tool) => ({
    type: "function",
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters,
    strict: true,
  }));
}

export async function executeAllowedTool(
  call: ToolCallRequest,
  allowedTools: AgentTool[],
  context: ToolExecutionContext,
  options: ExecuteToolOptions = {},
): Promise<ToolExecutionResult> {
  const startedAt = nowIso();
  const throwOnError = options.throwOnError ?? true;
  const tool = allowedTools.find((candidate) => candidate.name === call.name);
  let input: unknown;

  try {
    input = parseToolArguments(call.arguments);
  } catch (error) {
    return failToolCall(
      call,
      call.arguments,
      context,
      startedAt,
      ensureRuntimeError(error, "TOOL_INPUT_INVALID", "Tool arguments were not valid JSON", {
        runId: context.runId,
        agentKey: context.agentKey,
      }),
      throwOnError,
    );
  }

  if (!tool) {
    return failToolCall(
      call,
      input,
      context,
      startedAt,
      new AgentRuntimeError("TOOL_NOT_ALLOWED", `Tool "${call.name}" is not allowed for this agent`, {
        runId: context.runId,
        agentKey: context.agentKey,
        details: { allowed_tools: allowedTools.map((candidate) => candidate.name) },
      }),
      throwOnError,
    );
  }

  const validation = validateJsonSchema(tool.parameters, input);
  if (!validation.valid) {
    return failToolCall(
      call,
      input,
      context,
      startedAt,
      new AgentRuntimeError("TOOL_INPUT_INVALID", `Tool "${tool.name}" input failed schema validation`, {
        runId: context.runId,
        agentKey: context.agentKey,
        details: { errors: validation.errors },
      }),
      throwOnError,
    );
  }

  try {
    const output = await tool.execute(input, context);
    const completedAt = nowIso();
    const latencyMs = elapsedMs(startedAt, completedAt);
    const record: ToolCallAuditRecord = {
      id: call.id ?? createToolCallRecordId(tool.name),
      tool_name: tool.name,
      call_id: call.call_id,
      status: "completed",
      started_at: startedAt,
      completed_at: completedAt,
      latency_ms: latencyMs,
      input,
      output,
    };
    await context.audit.recordToolCall(context.runId, context.agentKey, record);
    return {
      ok: true,
      tool_name: tool.name,
      call_id: call.call_id,
      input,
      output,
      latency_ms: latencyMs,
    };
  } catch (error) {
    return failToolCall(
      call,
      input,
      context,
      startedAt,
      new AgentRuntimeError("TOOL_EXECUTION_FAILED", `Tool "${tool.name}" failed`, {
        runId: context.runId,
        agentKey: context.agentKey,
        cause: error,
      }),
      throwOnError,
    );
  }
}

export function parseToolArguments(args: unknown): unknown {
  if (typeof args !== "string") {
    return args ?? {};
  }

  const parsed = parseJsonObject(args);
  if (!parsed.ok) {
    throw new AgentRuntimeError("TOOL_INPUT_INVALID", "Tool arguments were not valid JSON", {
      details: { parse_error: parsed.error, raw_arguments: args },
    });
  }

  return parsed.value ?? {};
}

function createToolCallRecordId(toolName: string): string {
  return `tool_${toolName}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function failToolCall(
  call: ToolCallRequest,
  input: unknown,
  context: ToolExecutionContext,
  startedAt: string,
  error: AgentRuntimeError,
  throwOnError: boolean,
): Promise<ToolExecutionResult> {
  const completedAt = nowIso();
  const latencyMs = elapsedMs(startedAt, completedAt);
  const diagnostic = error.toDiagnostic();

  const record: ToolCallAuditRecord = {
    id: call.id ?? createToolCallRecordId(call.name),
    tool_name: call.name,
    call_id: call.call_id,
    status: "failed",
    started_at: startedAt,
    completed_at: completedAt,
    latency_ms: latencyMs,
    input,
    error: diagnostic,
  };

  await context.audit.recordToolCall(context.runId, context.agentKey, record);

  if (throwOnError) {
    throw error;
  }

  return {
    ok: false,
    tool_name: call.name,
    call_id: call.call_id,
    input,
    error: diagnostic,
    latency_ms: latencyMs,
  };
}
