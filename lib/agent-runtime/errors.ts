import type { AgentKey } from "../../contract/result";

export type RuntimeAgentKey = AgentKey | "packaging";

export type AgentRuntimeErrorCode =
  | "AUDIT_WRITE_FAILED"
  | "FIXTURE_NOT_FOUND"
  | "MODEL_OUTPUT_PARSE_FAILED"
  | "MODEL_REQUEST_FAILED"
  | "REPLAY_NOT_FOUND"
  | "RETRY_EXHAUSTED"
  | "SCHEMA_VALIDATION_FAILED"
  | "TIMEOUT"
  | "TOOL_EXECUTION_FAILED"
  | "TOOL_INPUT_INVALID"
  | "TOOL_NOT_ALLOWED"
  | "UNKNOWN";

export interface RuntimeErrorContext {
  runId?: string;
  agentKey?: RuntimeAgentKey;
  attempt?: number;
  details?: Record<string, unknown>;
  retryable?: boolean;
  cause?: unknown;
}

export interface DiagnosticError {
  code: AgentRuntimeErrorCode;
  message: string;
  run_id?: string;
  agent_key?: RuntimeAgentKey;
  attempt?: number;
  retryable: boolean;
  details?: Record<string, unknown>;
  cause?: string;
}

export class AgentRuntimeError extends Error {
  readonly code: AgentRuntimeErrorCode;
  readonly runId?: string;
  readonly agentKey?: RuntimeAgentKey;
  readonly attempt?: number;
  readonly details?: Record<string, unknown>;
  readonly retryable: boolean;
  readonly originalCause?: unknown;

  constructor(code: AgentRuntimeErrorCode, message: string, context: RuntimeErrorContext = {}) {
    super(message);
    this.name = "AgentRuntimeError";
    this.code = code;
    this.runId = context.runId;
    this.agentKey = context.agentKey;
    this.attempt = context.attempt;
    this.details = context.details;
    this.retryable = context.retryable ?? defaultRetryable(code);
    this.originalCause = context.cause;
  }

  toDiagnostic(): DiagnosticError {
    return {
      code: this.code,
      message: this.message,
      run_id: this.runId,
      agent_key: this.agentKey,
      attempt: this.attempt,
      retryable: this.retryable,
      details: this.details,
      cause: stringifyCause(this.originalCause),
    };
  }

  toJSON(): DiagnosticError {
    return this.toDiagnostic();
  }
}

export function toDiagnosticError(
  error: unknown,
  fallback: RuntimeErrorContext & { message?: string; code?: AgentRuntimeErrorCode } = {},
): DiagnosticError {
  if (error instanceof AgentRuntimeError) {
    return error.toDiagnostic();
  }

  const message =
    fallback.message ??
    (error instanceof Error ? error.message : typeof error === "string" ? error : "Unknown runtime error");

  return new AgentRuntimeError(fallback.code ?? "UNKNOWN", message, {
    runId: fallback.runId,
    agentKey: fallback.agentKey,
    attempt: fallback.attempt,
    details: fallback.details,
    retryable: fallback.retryable ?? false,
    cause: error,
  }).toDiagnostic();
}

export function ensureRuntimeError(
  error: unknown,
  code: AgentRuntimeErrorCode,
  message: string,
  context: RuntimeErrorContext = {},
): AgentRuntimeError {
  if (error instanceof AgentRuntimeError) {
    return error;
  }

  return new AgentRuntimeError(code, message, { ...context, cause: error });
}

function defaultRetryable(code: AgentRuntimeErrorCode): boolean {
  return code === "MODEL_REQUEST_FAILED" || code === "TIMEOUT" || code === "SCHEMA_VALIDATION_FAILED";
}

function stringifyCause(cause: unknown): string | undefined {
  if (!cause) {
    return undefined;
  }

  if (cause instanceof Error) {
    return `${cause.name}: ${cause.message}`;
  }

  if (typeof cause === "string") {
    return cause;
  }

  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}
