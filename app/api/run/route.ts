import { NextResponse, type NextRequest } from "next/server";

import type { Brief } from "../../../contract/result";
import { FileAuditSink, createAuditRunId } from "../../../lib/agent-runtime/audit";
import { resolveAuditRoot } from "../../../lib/agents/audit-root";
import { runOrchestration } from "../../../lib/agents/orchestrate";
import { ContractViolationError } from "../../../lib/agents/validate-run-result";
import { isSafeAuditRunId } from "../runs/[id]/audit/run-id";
import { DEFAULT_BRIEF } from "./default-brief";

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

  const withImages = req.nextUrl.searchParams.get("images") !== "0";
  const imageMode = withImages ? "live" : "dry-run";

  let brief: Brief;
  let clientRunId: string | undefined;
  try {
    const parsed = await parseBody(req);
    brief = parsed.brief;
    clientRunId = parsed.runId;
  } catch (error) {
    return NextResponse.json(
      { status: "bad_request", message: error instanceof Error ? error.message : "Invalid brief" },
      { status: 400 },
    );
  }

  const runId = clientRunId ?? createAuditRunId("run");
  const audit = new FileAuditSink(resolveAuditRoot());

  try {
    const result = await runOrchestration(brief, { runId, audit, textMode: "live", imageMode });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const isContract = error instanceof ContractViolationError;
    return NextResponse.json(
      {
        status: isContract ? "contract_violation" : "pipeline_error",
        message: error instanceof Error ? error.message : "Pipeline failed",
        ...(isContract ? { errors: error.errors } : {}),
        audit_run_id: runId,
      },
      { status: 500 },
    );
  }
}

// The brief is optional in the body — an empty POST falls back to the demo brief so
// the endpoint is curl-able and the frontend can drive it with a partial brief.
// body.run_id, when present, must match the safe audit-run-id format.
async function parseBody(req: NextRequest): Promise<{ brief: Brief; runId?: string }> {
  const text = await req.text();
  if (!text.trim()) return { brief: DEFAULT_BRIEF };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Request body must be valid JSON");
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new Error("Request body must be a Brief object");
  }

  const body = parsed as Record<string, unknown>;
  const { run_id: _runIdKey, ...bodyWithoutRunId } = body;
  const brief = (body.brief && typeof body.brief === "object"
    ? body.brief
    : bodyWithoutRunId) as Partial<Brief>;

  let runId: string | undefined;
  if (body.run_id !== undefined) {
    if (typeof body.run_id !== "string" || !isSafeAuditRunId(body.run_id)) {
      throw new Error('run_id must be a string matching "run_<alphanumeric/dash>"');
    }
    runId = body.run_id;
  }

  return { brief: { ...DEFAULT_BRIEF, ...brief }, runId };
}
