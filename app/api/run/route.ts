import { stat } from "node:fs/promises";
import { resolve } from "node:path";

import { NextResponse, type NextRequest } from "next/server";

import type { Brief } from "../../../contract/result";
import { FileAuditSink, createAuditRunId } from "../../../lib/agent-runtime/audit";
import { resolveAuditRoot } from "../../../lib/agents/audit-root";
import { runOrchestration } from "../../../lib/agents/orchestrate";
import { ContractViolationError } from "../../../lib/agents/validate-run-result";
import { BriefValidationError, parseBriefBody } from "../../../lib/runtime/parse-brief";

export const runtime = "nodejs";
// Full live pipeline takes 2-4 minutes; default serverless limits would kill it.
export const maxDuration = 300;

// POST /api/run — runs the 7-agent live pipeline and returns a contract-valid RunResult.
//   ?images=0  → live text pipeline, packaging skips image generation (快速彩排)
//   body.run_id (optional, client-generated, "run_..." format) → used as the audit run id
//     so the frontend can poll GET /api/runs/:id/audit DURING the run for progressive
//     agent status (War Room 渐进点亮).
// Requires OPENAI_API_KEY; without it the endpoint refuses to serve rather than
// silently degrading to canned data (single-real-path rule, see docs/REFACTOR.md).
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

  // Default is live images; only an explicit opt-out disables them (?images=0|false|no).
  // Anything else (including absent) runs live so we never silently skip image generation.
  const imagesParam = (req.nextUrl.searchParams.get("images") ?? "").trim().toLowerCase();
  const imagesDisabled = imagesParam === "0" || imagesParam === "false" || imagesParam === "no";
  const imageMode = imagesDisabled ? "dry-run" : "live";

  let brief: Brief;
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

  const auditRoot = resolveAuditRoot();

  // Reject a client-supplied run_id whose audit dir already exists, so two runs can't
  // overwrite / interleave each other's audit trail. Server-generated ids are unique.
  if (clientRunId && (await auditRunIdExists(auditRoot, clientRunId))) {
    return NextResponse.json(
      {
        status: "run_id_conflict",
        message: `run_id "${clientRunId}" already has an audit record; pick a fresh run_id`,
        audit_run_id: clientRunId,
      },
      { status: 409 },
    );
  }

  const runId = clientRunId ?? createAuditRunId("run");
  const audit = new FileAuditSink(auditRoot);

  try {
    const result = await runOrchestration(brief, { runId, audit, textMode: "live", imageMode });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    // Always log the full error server-side; the client gets a generic message + the
    // audit_run_id (to poll the audit trail). Internal details are only surfaced behind
    // an explicit debug flag so production responses don't leak stack/internal state.
    console.error(`[/api/run] pipeline failed for run ${runId}:`, error);

    const isContract = error instanceof ContractViolationError;
    const debug = process.env.DEBUG_ERRORS === "1";

    return NextResponse.json(
      {
        status: isContract ? "contract_violation" : "pipeline_error",
        message: debug
          ? error instanceof Error
            ? error.message
            : "Pipeline failed"
          : "The pipeline failed to produce a valid result. See server logs or the audit trail for details.",
        ...(isContract && debug ? { errors: error.errors } : {}),
        audit_run_id: runId,
      },
      { status: 500 },
    );
  }
}

// True if an audit directory for this (already format-validated) run id exists on disk.
async function auditRunIdExists(auditRoot: string, runId: string): Promise<boolean> {
  try {
    const dir = resolve(auditRoot, runId);
    const info = await stat(dir);
    return info.isDirectory();
  } catch {
    return false;
  }
}
