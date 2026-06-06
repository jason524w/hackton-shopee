import { NextResponse, type NextRequest } from "next/server";

import type { Brief } from "../../../contract/result";
import { FileAuditSink, createAuditRunId } from "../../../lib/agent-runtime/audit";
import { resolveAuditRoot } from "../../../lib/agents/audit-root";
import { runOrchestration } from "../../../lib/agents/orchestrate";
import { ContractViolationError } from "../../../lib/agents/validate-run-result";
import { DEFAULT_BRIEF } from "./default-brief";

export const runtime = "nodejs";

// POST /api/run — runs the 7-agent live pipeline and returns a contract-valid RunResult.
//   ?images=0  → live text pipeline, packaging skips image generation (快速彩排)
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
  try {
    brief = await parseBrief(req);
  } catch (error) {
    return NextResponse.json(
      { status: "bad_request", message: error instanceof Error ? error.message : "Invalid brief" },
      { status: 400 },
    );
  }

  const runId = createAuditRunId("run");
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
async function parseBrief(req: NextRequest): Promise<Brief> {
  const text = await req.text();
  if (!text.trim()) return DEFAULT_BRIEF;

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
  const brief = (body.brief && typeof body.brief === "object" ? body.brief : body) as Partial<Brief>;
  return { ...DEFAULT_BRIEF, ...brief };
}
