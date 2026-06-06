import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

import type { Brief } from "../../../contract/result";
import { FileAuditSink, createAuditRunId } from "../../../lib/agent-runtime/audit";
import { AUDIT_ROOT_DIR, runOrchestration } from "../../../lib/agents/orchestrate";
import { ContractViolationError } from "../../../lib/agents/validate-run-result";
import { DEFAULT_BRIEF } from "./default-brief";

export const runtime = "nodejs";

// POST /api/run — runs the 7-agent pipeline and returns a contract-valid RunResult.
//   ?mock=1         → return contract/mock-result.json (铁律 3 安全网,永不可移除)
//   DEMO_MOCK_ONLY  → force mock regardless of query (demo 兜底)
//   ?images=0       → live text pipeline, packaging skips image generation (快速彩排)
//   live (default)  → full pipeline. Text agents run live when OPENAI_API_KEY is set,
//                     otherwise they fall back to deterministic seed-backed fixtures
//                     so the endpoint always returns a valid RunResult.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const mock = req.nextUrl.searchParams.get("mock") === "1";
  const demoMockOnly = process.env.DEMO_MOCK_ONLY === "true";

  if (mock || demoMockOnly) {
    const raw = await readFile(join(process.cwd(), "contract", "mock-result.json"), "utf8");
    return new NextResponse(raw, {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }

  const withImages = req.nextUrl.searchParams.get("images") !== "0";
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  // No key → seed-backed fixtures + dry-run images so live path still returns valid data.
  const textMode = hasKey ? "live" : "fixture";
  const imageMode = hasKey && withImages ? "live" : "dry-run";

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
  const audit = new FileAuditSink(AUDIT_ROOT_DIR);

  try {
    const result = await runOrchestration(brief, { runId, audit, textMode, imageMode });
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    const isContract = error instanceof ContractViolationError;
    return NextResponse.json(
      {
        status: isContract ? "contract_violation" : "pipeline_error",
        message: error instanceof Error ? error.message : "Pipeline failed",
        ...(isContract ? { errors: error.errors } : {}),
        audit_run_id: runId,
        hint: "Live pipeline failed — fall back to POST /api/run?mock=1 (永不移除的安全网).",
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
