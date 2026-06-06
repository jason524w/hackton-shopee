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

export async function runPipeline(brief: Brief, opts?: { images?: boolean }): Promise<RunResult> {
  const params = opts?.images === false ? "?images=0" : "";
  const response = await fetch(`${BASE_URL}/api/run${params}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ brief }),
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
