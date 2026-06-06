import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { RuntimeAgentKey, DiagnosticError } from "./errors";
import type { SchemaValidationResult } from "./schemas";

export type AuditRunStatus = "completed" | "failed" | "running";
export type ToolAuditStatus = "completed" | "failed";

export interface TokenUsage {
  input_tokens?: number;
  output_tokens?: number;
  total_tokens?: number;
  [key: string]: unknown;
}

export interface ToolCallAuditRecord {
  id: string;
  tool_name: string;
  call_id?: string;
  status: ToolAuditStatus;
  started_at: string;
  completed_at: string;
  latency_ms: number;
  input: unknown;
  output?: unknown;
  error?: DiagnosticError;
}

export interface ModelResponseAuditRecord {
  id: string;
  model: string;
  response_id?: string;
  status?: string;
  started_at: string;
  completed_at: string;
  latency_ms: number;
  output_item_types: string[];
  output_text_preview?: string;
  tokens?: TokenUsage;
}

export interface SchemaAuditRecord {
  name: string;
  attempt: number;
  checked_at: string;
  result: SchemaValidationResult;
}

export interface AgentAuditSnapshot {
  run_id: string;
  agent_key: RuntimeAgentKey;
  skill_version?: string;
  mode: "fixture" | "live";
  status: AuditRunStatus;
  started_at: string;
  completed_at?: string;
  latency_ms?: number;
  input_snapshot: unknown;
  output_snapshot?: unknown;
  tool_calls: ToolCallAuditRecord[];
  model_responses: ModelResponseAuditRecord[];
  schema_results: SchemaAuditRecord[];
  error?: DiagnosticError;
  metadata?: Record<string, unknown>;
}

export interface StartAgentAuditInput {
  runId: string;
  agentKey: RuntimeAgentKey;
  skillVersion?: string;
  mode: AgentAuditSnapshot["mode"];
  input: unknown;
  metadata?: Record<string, unknown>;
}

export interface AuditSink {
  startAgent(input: StartAgentAuditInput): Promise<void>;
  recordToolCall(runId: string, agentKey: RuntimeAgentKey, record: ToolCallAuditRecord): Promise<void>;
  recordModelResponse(runId: string, agentKey: RuntimeAgentKey, record: ModelResponseAuditRecord): Promise<void>;
  recordSchemaResult(runId: string, agentKey: RuntimeAgentKey, record: SchemaAuditRecord): Promise<void>;
  completeAgent(runId: string, agentKey: RuntimeAgentKey, output: unknown): Promise<void>;
  failAgent(runId: string, agentKey: RuntimeAgentKey, error: DiagnosticError): Promise<void>;
  getAgentSnapshot(runId: string, agentKey: RuntimeAgentKey): Promise<AgentAuditSnapshot | undefined>;
}

export class InMemoryAuditSink implements AuditSink {
  private readonly snapshots = new Map<string, AgentAuditSnapshot>();

  async startAgent(input: StartAgentAuditInput): Promise<void> {
    this.snapshots.set(key(input.runId, input.agentKey), {
      run_id: input.runId,
      agent_key: input.agentKey,
      skill_version: input.skillVersion,
      mode: input.mode,
      status: "running",
      started_at: nowIso(),
      input_snapshot: redactSecrets(input.input),
      tool_calls: [],
      model_responses: [],
      schema_results: [],
      metadata: input.metadata,
    });
  }

  async recordToolCall(runId: string, agentKey: RuntimeAgentKey, record: ToolCallAuditRecord): Promise<void> {
    this.requireSnapshot(runId, agentKey).tool_calls.push(redactSecrets(record) as ToolCallAuditRecord);
  }

  async recordModelResponse(
    runId: string,
    agentKey: RuntimeAgentKey,
    record: ModelResponseAuditRecord,
  ): Promise<void> {
    this.requireSnapshot(runId, agentKey).model_responses.push(redactSecrets(record) as ModelResponseAuditRecord);
  }

  async recordSchemaResult(runId: string, agentKey: RuntimeAgentKey, record: SchemaAuditRecord): Promise<void> {
    this.requireSnapshot(runId, agentKey).schema_results.push(record);
  }

  async completeAgent(runId: string, agentKey: RuntimeAgentKey, output: unknown): Promise<void> {
    const snapshot = this.requireSnapshot(runId, agentKey);
    snapshot.status = "completed";
    snapshot.completed_at = nowIso();
    snapshot.latency_ms = elapsedMs(snapshot.started_at, snapshot.completed_at);
    snapshot.output_snapshot = redactSecrets(output);
  }

  async failAgent(runId: string, agentKey: RuntimeAgentKey, error: DiagnosticError): Promise<void> {
    const snapshot = this.requireSnapshot(runId, agentKey);
    snapshot.status = "failed";
    snapshot.completed_at = nowIso();
    snapshot.latency_ms = elapsedMs(snapshot.started_at, snapshot.completed_at);
    snapshot.error = error;
  }

  async getAgentSnapshot(runId: string, agentKey: RuntimeAgentKey): Promise<AgentAuditSnapshot | undefined> {
    return clone(this.snapshots.get(key(runId, agentKey)));
  }

  private requireSnapshot(runId: string, agentKey: RuntimeAgentKey): AgentAuditSnapshot {
    const snapshot = this.snapshots.get(key(runId, agentKey));
    if (!snapshot) {
      throw new Error(`Audit snapshot not started for ${runId}/${agentKey}`);
    }
    return snapshot;
  }
}

export class FileAuditSink implements AuditSink {
  private readonly memory = new InMemoryAuditSink();
  private readonly rootDir: string;

  constructor(rootDir = ".runs") {
    this.rootDir = rootDir;
  }

  async startAgent(input: StartAgentAuditInput): Promise<void> {
    await this.memory.startAgent(input);
    await this.flush(input.runId, input.agentKey);
  }

  async recordToolCall(runId: string, agentKey: RuntimeAgentKey, record: ToolCallAuditRecord): Promise<void> {
    await this.memory.recordToolCall(runId, agentKey, record);
    await this.flush(runId, agentKey);
  }

  async recordModelResponse(
    runId: string,
    agentKey: RuntimeAgentKey,
    record: ModelResponseAuditRecord,
  ): Promise<void> {
    await this.memory.recordModelResponse(runId, agentKey, record);
    await this.flush(runId, agentKey);
  }

  async recordSchemaResult(runId: string, agentKey: RuntimeAgentKey, record: SchemaAuditRecord): Promise<void> {
    await this.memory.recordSchemaResult(runId, agentKey, record);
    await this.flush(runId, agentKey);
  }

  async completeAgent(runId: string, agentKey: RuntimeAgentKey, output: unknown): Promise<void> {
    await this.memory.completeAgent(runId, agentKey, output);
    await this.flush(runId, agentKey);
  }

  async failAgent(runId: string, agentKey: RuntimeAgentKey, error: DiagnosticError): Promise<void> {
    await this.memory.failAgent(runId, agentKey, error);
    await this.flush(runId, agentKey);
  }

  async getAgentSnapshot(runId: string, agentKey: RuntimeAgentKey): Promise<AgentAuditSnapshot | undefined> {
    return this.memory.getAgentSnapshot(runId, agentKey);
  }

  async readAgentSnapshot(runId: string, agentKey: RuntimeAgentKey): Promise<AgentAuditSnapshot> {
    const raw = await readFile(this.agentPath(runId, agentKey), "utf8");
    return JSON.parse(raw) as AgentAuditSnapshot;
  }

  private async flush(runId: string, agentKey: RuntimeAgentKey): Promise<void> {
    const snapshot = await this.memory.getAgentSnapshot(runId, agentKey);
    if (!snapshot) {
      return;
    }
    await mkdir(join(this.rootDir, runId, "agents"), { recursive: true });
    await writeFile(this.agentPath(runId, agentKey), `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  }

  private agentPath(runId: string, agentKey: RuntimeAgentKey): string {
    return join(this.rootDir, runId, "agents", `${agentKey}.json`);
  }
}

export function createAuditRunId(prefix = "run"): string {
  const randomUuid = (globalThis as unknown as { crypto?: { randomUUID?: () => string } }).crypto?.randomUUID?.();
  const suffix = randomUuid ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${suffix}`;
}

export function buildModelAuditRecord(input: {
  id: string;
  model: string;
  response: unknown;
  startedAt: string;
  completedAt: string;
  latencyMs: number;
}): ModelResponseAuditRecord {
  const response = asRecord(input.response);
  const output = Array.isArray(response.output) ? response.output : [];

  return {
    id: input.id,
    model: input.model,
    response_id: typeof response.id === "string" ? response.id : undefined,
    status: typeof response.status === "string" ? response.status : undefined,
    started_at: input.startedAt,
    completed_at: input.completedAt,
    latency_ms: input.latencyMs,
    output_item_types: output.map((item) => String(asRecord(item).type ?? "unknown")),
    output_text_preview: previewText(typeof response.output_text === "string" ? response.output_text : undefined),
    tokens: asTokenUsage(response.usage),
  };
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function elapsedMs(startIso: string, endIso: string): number {
  return Math.max(0, new Date(endIso).getTime() - new Date(startIso).getTime());
}

export function redactSecrets(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecrets);
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const [field, fieldValue] of Object.entries(value as Record<string, unknown>)) {
    if (/api[_-]?key|authorization|cookie|password|secret|token/i.test(field)) {
      result[field] = "[redacted]";
    } else {
      result[field] = redactSecrets(fieldValue);
    }
  }
  return result;
}

function key(runId: string, agentKey: RuntimeAgentKey): string {
  return `${runId}:${agentKey}`;
}

function clone<T>(value: T): T {
  if (value === undefined) {
    return value;
  }
  return JSON.parse(JSON.stringify(value)) as T;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function asTokenUsage(value: unknown): TokenUsage | undefined {
  const record = asRecord(value);
  return Object.keys(record).length ? (record as TokenUsage) : undefined;
}

function previewText(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }
  return value.length > 500 ? `${value.slice(0, 500)}...` : value;
}
