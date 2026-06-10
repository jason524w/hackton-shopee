import { stat } from "node:fs/promises";
import { resolve } from "node:path";

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

  // Default is live images; only an explicit opt-out disables them (?images=0|false|no).
  // Anything else (including absent) runs live so we never silently skip image generation.
  const imagesParam = (req.nextUrl.searchParams.get("images") ?? "").trim().toLowerCase();
  const imagesDisabled = imagesParam === "0" || imagesParam === "false" || imagesParam === "no";
  const imageMode = imagesDisabled ? "dry-run" : "live";

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

// Reject oversized bodies before parsing — a 5MB brief string would otherwise flow
// straight into the prompt (injection + token-cost surface).
const MAX_BODY_BYTES = 256 * 1024; // 256KB
const MAX_STRING_LEN = 2000;

// The brief is optional in the body — an empty POST falls back to the demo brief so
// the endpoint is curl-able and the frontend can drive it with a partial brief.
// body.run_id, when present, must match the safe audit-run-id format.
//
// Unknown keys are dropped and every known field is type/length-checked, so malformed
// input is rejected with a 400 here (before the 2-4 minute pipeline starts) rather than
// surfacing as a contract violation at the very end.
async function parseBody(req: NextRequest): Promise<{ brief: Brief; runId?: string }> {
  const text = await req.text();
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new Error(`Request body too large (max ${MAX_BODY_BYTES} bytes)`);
  }
  if (!text.trim()) return { brief: DEFAULT_BRIEF };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Request body must be valid JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Request body must be a Brief object");
  }

  const body = parsed as Record<string, unknown>;
  const { run_id: _runIdKey, brief: _briefKey, ...bodyWithoutMeta } = body;
  const rawBrief =
    body.brief && typeof body.brief === "object" && !Array.isArray(body.brief)
      ? (body.brief as Record<string, unknown>)
      : bodyWithoutMeta;

  let runId: string | undefined;
  if (body.run_id !== undefined) {
    if (typeof body.run_id !== "string" || !isSafeAuditRunId(body.run_id)) {
      throw new Error('run_id must be a string matching "run_<alphanumeric/dash>"');
    }
    runId = body.run_id;
  }

  return { brief: { ...DEFAULT_BRIEF, ...sanitizeBrief(rawBrief) }, runId };
}

// Whitelist + type/length-check the known Brief fields, dropping everything else.
// Missing fields fall through to DEFAULT_BRIEF via the merge in parseBody.
function sanitizeBrief(raw: Record<string, unknown>): Partial<Brief> {
  const out: Partial<Brief> = {};

  const str = (key: keyof Brief): string | undefined => {
    const v = raw[key];
    if (v === undefined) return undefined;
    if (typeof v !== "string") throw new Error(`brief.${key} must be a string`);
    if (v.length > MAX_STRING_LEN) throw new Error(`brief.${key} exceeds ${MAX_STRING_LEN} characters`);
    return v;
  };

  const num = (key: keyof Brief): number | undefined => {
    const v = raw[key];
    if (v === undefined) return undefined;
    if (typeof v !== "number" || !Number.isFinite(v)) throw new Error(`brief.${key} must be a finite number`);
    return v;
  };

  const enumStr = <T extends string>(key: keyof Brief, allowed: readonly T[]): T | undefined => {
    const v = str(key);
    if (v === undefined) return undefined;
    if (!allowed.includes(v as T)) throw new Error(`brief.${key} must be one of: ${allowed.join(", ")}`);
    return v as T;
  };

  const targetMarket = str("target_market");
  if (targetMarket !== undefined) out.target_market = targetMarket;

  const targetPlatform = enumStr("target_platform", ["Shopee", "Lazada"] as const);
  if (targetPlatform !== undefined) out.target_platform = targetPlatform;

  const sellerType = str("seller_type");
  if (sellerType !== undefined) out.seller_type = sellerType;

  const productIntent = str("product_intent");
  if (productIntent !== undefined) out.product_intent = productIntent;

  const category = str("category");
  if (category !== undefined) out.category = category;

  const budget = num("budget");
  if (budget !== undefined) out.budget = budget;

  const targetMargin = num("target_margin");
  if (targetMargin !== undefined) {
    if (targetMargin < 0 || targetMargin > 1) throw new Error("brief.target_margin must be between 0 and 1");
    out.target_margin = targetMargin;
  }

  const maxFulfillmentDays = num("max_fulfillment_days");
  if (maxFulfillmentDays !== undefined) out.max_fulfillment_days = maxFulfillmentDays;

  const riskAppetite = enumStr("risk_appetite", ["conservative", "balanced", "aggressive"] as const);
  if (riskAppetite !== undefined) out.risk_appetite = riskAppetite;

  const language = str("language");
  if (language !== undefined) out.language = language;

  return out;
}
