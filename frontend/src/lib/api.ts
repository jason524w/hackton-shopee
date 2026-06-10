// Client for the live pipeline API. The backend Next app (repo root) serves
// POST /api/run; when the two apps are deployed separately set
// NEXT_PUBLIC_API_BASE_URL to the backend origin (e.g. https://api.sealaunch.ai).
import type { Brief, RunResult } from "../../../contract/result";

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "";

// The live pipeline can run 3-4 minutes (worst case ~6). Give it a generous
// ceiling so the UI fails with a clear message instead of hanging forever.
const RUN_TIMEOUT_MS = 8 * 60 * 1000;

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
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RUN_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/api/run${params}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ brief, ...(opts?.runId ? { run_id: opts.runId } : {}) }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new PipelineError(
        `Pipeline timed out after ${Math.round(RUN_TIMEOUT_MS / 60000)} minutes. The backend may be overloaded or stuck — try again.`,
        408,
      );
    }
    throw new PipelineError(
      "Could not reach the pipeline. Check that the backend is running and reachable.",
      0,
      error,
    );
  } finally {
    clearTimeout(timeout);
  }

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
