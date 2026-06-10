import { NextResponse, type NextRequest } from "next/server";

import { parseBriefBody, BriefValidationError } from "../../../lib/runtime/parse-brief";
import { getRunsService } from "../../../lib/runtime/runs-service";
import { RunAlreadyExistsError } from "../../../lib/runtime/run-store";

export const runtime = "nodejs";

// POST /api/runs — submit a run for ASYNCHRONOUS execution.
//   Returns 202 immediately with { run_id, status: "queued" }; a background worker runs
//   the 7-agent live pipeline. Poll GET /api/runs/:id for status + result, and
//   GET /api/runs/:id/audit for per-agent progress.
//   ?images=0|false|no → packaging skips image generation (faster rehearsal).
//   body.run_id (optional, "run_..." format) → used as the run id.
// Requires OPENAI_API_KEY; without it the endpoint refuses rather than degrading.
export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json(
      {
        status: "not_configured",
        message: "OPENAI_API_KEY is not set. The live pipeline is the only path; configure the key to run.",
      },
      { status: 503 },
    );
  }

  const imagesParam = (req.nextUrl.searchParams.get("images") ?? "").trim().toLowerCase();
  const imagesDisabled = imagesParam === "0" || imagesParam === "false" || imagesParam === "no";
  const imageMode = imagesDisabled ? "dry-run" : "live";

  let brief;
  let clientRunId: string | undefined;
  try {
    const parsed = parseBriefBody(await req.text());
    brief = parsed.brief;
    clientRunId = parsed.runId;
  } catch (error) {
    if (error instanceof BriefValidationError) {
      return NextResponse.json({ status: "bad_request", message: error.message }, { status: 400 });
    }
    throw error;
  }

  const service = getRunsService();
  try {
    const { runId } = await service.submitRun({ brief, runId: clientRunId, imageMode, textMode: "live" });
    return NextResponse.json({ status: "queued", run_id: runId, audit_run_id: runId }, { status: 202 });
  } catch (error) {
    if (error instanceof RunAlreadyExistsError) {
      return NextResponse.json(
        {
          status: "run_id_conflict",
          message: `run_id "${clientRunId}" already exists; pick a fresh run_id`,
          audit_run_id: clientRunId,
        },
        { status: 409 },
      );
    }
    console.error("[/api/runs] failed to enqueue run:", error);
    return NextResponse.json(
      { status: "enqueue_error", message: "Failed to queue the run. See server logs." },
      { status: 500 },
    );
  }
}
