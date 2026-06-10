import type { Brief } from "../../contract/result";
import { DEFAULT_BRIEF } from "../../app/api/run/default-brief";
import { isSafeAuditRunId } from "../../app/api/runs/[id]/audit/run-id";

// Reject oversized bodies before parsing — a 5MB brief string would otherwise flow
// straight into the prompt (injection + token-cost surface).
export const MAX_BODY_BYTES = 256 * 1024; // 256KB
const MAX_STRING_LEN = 2000;

export class BriefValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "BriefValidationError";
  }
}

/**
 * Parse + validate a request body into a Brief (+ optional client run_id).
 *
 * Shared by the sync `/api/run` and async `/api/runs` entrypoints so both apply the same
 * size cap, type/length checks, enum validation, and unknown-key dropping. Throws
 * BriefValidationError (→ HTTP 400) on bad input; an empty body falls back to DEFAULT_BRIEF.
 */
export function parseBriefBody(text: string): { brief: Brief; runId?: string } {
  if (Buffer.byteLength(text, "utf8") > MAX_BODY_BYTES) {
    throw new BriefValidationError(`Request body too large (max ${MAX_BODY_BYTES} bytes)`);
  }
  if (!text.trim()) return { brief: DEFAULT_BRIEF };

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BriefValidationError("Request body must be valid JSON");
  }

  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new BriefValidationError("Request body must be a Brief object");
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
      throw new BriefValidationError('run_id must be a string matching "run_<alphanumeric/dash>"');
    }
    runId = body.run_id;
  }

  return { brief: { ...DEFAULT_BRIEF, ...sanitizeBrief(rawBrief) }, runId };
}

// Whitelist + type/length-check the known Brief fields, dropping everything else.
// Missing fields fall through to DEFAULT_BRIEF via the merge in parseBriefBody.
export function sanitizeBrief(raw: Record<string, unknown>): Partial<Brief> {
  const out: Partial<Brief> = {};

  const str = (key: keyof Brief): string | undefined => {
    const v = raw[key];
    if (v === undefined) return undefined;
    if (typeof v !== "string") throw new BriefValidationError(`brief.${key} must be a string`);
    if (v.length > MAX_STRING_LEN) throw new BriefValidationError(`brief.${key} exceeds ${MAX_STRING_LEN} characters`);
    return v;
  };

  const num = (key: keyof Brief): number | undefined => {
    const v = raw[key];
    if (v === undefined) return undefined;
    if (typeof v !== "number" || !Number.isFinite(v)) throw new BriefValidationError(`brief.${key} must be a finite number`);
    return v;
  };

  const enumStr = <T extends string>(key: keyof Brief, allowed: readonly T[]): T | undefined => {
    const v = str(key);
    if (v === undefined) return undefined;
    if (!allowed.includes(v as T)) throw new BriefValidationError(`brief.${key} must be one of: ${allowed.join(", ")}`);
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
    if (targetMargin < 0 || targetMargin > 1) throw new BriefValidationError("brief.target_margin must be between 0 and 1");
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
