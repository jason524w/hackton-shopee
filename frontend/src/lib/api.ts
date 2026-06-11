// Client for the live pipeline API. The backend Next app (repo root) serves the
// ASYNC run endpoints: POST /api/runs (enqueue) + GET /api/runs/:id (status/result).
// When the two apps are deployed separately set NEXT_PUBLIC_API_BASE_URL to the
// backend origin (e.g. https://api.sealaunch.ai).
import type { Brief, RunResult } from "../../../contract/result";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// Per-request network timeout. Individual calls are short now (submit returns
// immediately, status is a quick poll) — the long pipeline runs server-side.
const REQUEST_TIMEOUT_MS = 20 * 1000;

export class PipelineError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly payload?: unknown,
  ) {
    super(message);
    this.name = "PipelineError";
  }
}

export type RunPhase = "queued" | "running" | "completed" | "failed";

export interface RunStatusResponse {
  run_id: string;
  status: RunPhase;
  current_agent?: string;
  created_at?: string;
  started_at?: string;
  finished_at?: string;
  result?: RunResult;
  error?: { message: string; kind: string };
}

async function fetchJson(
  path: string,
  init?: RequestInit,
): Promise<{ ok: boolean; status: number; payload: unknown }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new PipelineError("Request to the backend timed out. It may be overloaded — try again.", 408);
    }
    throw new PipelineError("Could not reach the backend. Check that it is running and reachable.", 0, error);
  } finally {
    clearTimeout(timeout);
  }
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PipelineError(`Backend returned a non-JSON response (HTTP ${response.status})`, response.status);
  }
  return { ok: response.ok, status: response.status, payload };
}

function messageOf(payload: unknown, fallback: string): string {
  return payload && typeof payload === "object" && "message" in payload
    ? String((payload as { message: unknown }).message)
    : fallback;
}

// Enqueue a run; returns immediately with the run id (the pipeline runs server-side).
export async function submitRun(
  brief: Brief,
  opts?: { images?: boolean; runId?: string },
): Promise<{ runId: string }> {
  const params = opts?.images === false ? "?images=0" : "";
  const { ok, status, payload } = await fetchJson(`/api/runs${params}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief, ...(opts?.runId ? { run_id: opts.runId } : {}) }),
  });
  if (!ok) {
    throw new PipelineError(messageOf(payload, `Failed to submit run (HTTP ${status})`), status, payload);
  }
  const runId = (payload as { run_id?: string })?.run_id;
  if (!runId) {
    throw new PipelineError("Backend accepted the run but returned no run_id.", status, payload);
  }
  return { runId };
}

// Poll a run's status + (when complete) its result.
export async function fetchRunStatus(runId: string): Promise<RunStatusResponse> {
  const { ok, status, payload } = await fetchJson(`/api/runs/${encodeURIComponent(runId)}`);
  if (!ok) {
    throw new PipelineError(messageOf(payload, `Could not fetch run status (HTTP ${status})`), status, payload);
  }
  return payload as RunStatusResponse;
}

export function newRunId(): string {
  const uuid =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
  return `run_${uuid}`;
}

export interface AgentAuditSnapshot {
  agent_key: string;
  status: "running" | "completed" | "failed";
}

// Polled during a run to light departments up progressively (War Room 渐进点亮).
// Returns [] until the first agent snapshot lands (404 from the audit endpoint).
export async function fetchAuditSnapshots(runId: string): Promise<AgentAuditSnapshot[]> {
  try {
    const response = await fetch(`${BASE_URL}/api/runs/${encodeURIComponent(runId)}/audit`);
    if (!response.ok) return [];
    const payload = (await response.json()) as { agents?: AgentAuditSnapshot[] };
    return payload.agents ?? [];
  } catch {
    return []; // polling is best-effort; the POST result is the source of truth
  }
}
