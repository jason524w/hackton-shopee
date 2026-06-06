import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse, type NextRequest } from "next/server";

import type { Brief } from "../../../contract/result";
import { FileAuditSink, createAuditRunId } from "../../../lib/agent-runtime/audit";
import { AUDIT_ROOT_DIR, runOrchestration } from "../../../lib/agents/orchestrate";
import { ContractViolationError } from "../../../lib/agents/validate-run-result";
import { DEFAULT_BRIEF } from "./default-brief";

export const runtime = "nodejs";

// POST /api/run
//   ?mock=1         → return contract/mock-result.json (铁律 3 安全网,永不可移除)
//   DEMO_MOCK_ONLY  → force mock regardless of query (demo 兜底)
//   ?images=0       → text pipeline, Packaging Agent skips live image generation
//   ?mode=fixture   → fixture text agents even when OPENAI_API_KEY exists
//   live default    → use live OpenAI text/image agents when OPENAI_API_KEY exists,
//                     while provider data follows the orchestrator's configured adapters.
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
  const forceFixture = req.nextUrl.searchParams.get("mode") === "fixture";
  const hasKey = Boolean(process.env.OPENAI_API_KEY);
  const liveImagesEnabled = process.env.LIVE_IMAGE_GENERATION !== "false";
  const textMode = forceFixture || !hasKey ? "fixture" : "live";
  const imageMode = hasKey && withImages && liveImagesEnabled ? "live" : "dry-run";

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
        hint: "Pipeline failed. The demo safety net remains POST /api/run?mock=1.",
      },
      { status: 500 },
    );
  }
}

async function parseBrief(req: NextRequest): Promise<Brief> {
  const text = await req.text();
  if (!text.trim()) {
    return DEFAULT_BRIEF;
  }

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
