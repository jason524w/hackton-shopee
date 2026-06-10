import { NextResponse } from "next/server";

import { getRunsService } from "../../../../lib/runtime/runs-service";
import { isSafeAuditRunId } from "./audit/run-id";

export const runtime = "nodejs";

// GET /api/runs/:id — async run status + result.
//   { status: "queued"|"running"|"completed"|"failed", current_agent?, result?, error? }
// Use alongside GET /api/runs/:id/audit for per-agent progress detail.
export async function GET(_req: Request, { params }: { params: { id: string } }): Promise<NextResponse> {
  const runId = params.id;
  if (!isSafeAuditRunId(runId)) {
    return NextResponse.json({ status: "bad_request", message: "Invalid run id" }, { status: 400 });
  }

  const record = await getRunsService().getRun(runId);
  if (!record) {
    return NextResponse.json({ status: "not_found", message: `No run ${runId}` }, { status: 404 });
  }

  return NextResponse.json(
    {
      run_id: record.run_id,
      status: record.status,
      current_agent: record.current_agent,
      created_at: record.created_at,
      started_at: record.started_at,
      finished_at: record.finished_at,
      result: record.result,
      error: record.error,
    },
    { status: 200 },
  );
}
