// Client for the live pipeline API. The backend Next app (repo root) serves
// POST /api/run; when the two apps are deployed separately set
// NEXT_PUBLIC_API_BASE_URL to the backend origin (e.g. https://api.sealaunch.ai).
import type { Brief, RunResult } from "../../../contract/result";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

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

export async function runPipeline(
  brief: Brief,
  opts?: { images?: boolean; runId?: string },
): Promise<RunResult> {
  const params = opts?.images === false ? "?images=0" : "";
  const response = await fetch(`${BASE_URL}/api/run${params}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief, ...(opts?.runId ? { run_id: opts.runId } : {}) }),
  });

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    throw new PipelineError(`Pipeline returned a non-JSON response (HTTP ${response.status})`, response.status);
  }

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message: unknown }).message)
        : `Pipeline failed (HTTP ${response.status})`;
    throw new PipelineError(message, response.status, payload);
  }

  return payload as RunResult;
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
