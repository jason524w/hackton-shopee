// Deterministic risk pre-check — the demo safety net. Pure functions, CI-runnable.
// Whatever the demo depends on (exaggerated-suction warning, electrical human
// review) lives HERE, never in the degradable LLM layer. See docs/design/margin-risk.md §4.

import type { Evidence, RiskLevel } from "../../../contract/result";
import type { RiskCheckpointStage } from "../contracts";
import { findBannedClaims } from "./claims";

export interface DeterministicResult {
  risk_level: RiskLevel;
  human_review_required: boolean;
  hard_block: boolean;
  warnings: string[];
  evidence: Evidence[];
  flags: string[];
}

const ELECTRICAL_CATEGORIES = ["home_appliances_small", "electronics", "appliance"];

function empty(): DeterministicResult {
  return {
    risk_level: "low",
    human_review_required: false,
    hard_block: false,
    warnings: [],
    evidence: [],
    flags: [],
  };
}

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

function isElectrical(category?: string): boolean {
  if (!category) return false;
  const c = category.toLowerCase();
  return ELECTRICAL_CATEGORIES.some((k) => c.includes(k)) || /usb|cordless|rechargeable|battery/.test(c);
}

/** Scan free text (title/description/bullets/prompt) for banned claims. */
function scanClaims(result: DeterministicResult, text: string, where: string): void {
  for (const hit of findBannedClaims(text)) {
    result.warnings.push(`避免夸大表述「${hit.term}」(${where})`);
    result.flags.push(`exaggerated_claim:${hit.term}`);
    result.evidence.push({ label: "夸大宣传", value: `⚠ ${where}: "${hit.matched}"` });
    result.risk_level = maxLevel(result.risk_level, "medium");
  }
}

export function runDeterministic(stage: RiskCheckpointStage, payload: unknown): DeterministicResult {
  const p = (payload ?? {}) as Record<string, unknown>;
  const result = empty();

  if (stage === "margin") {
    const margin = p.margin as { low?: { net_margin?: number } } | undefined;
    const target = typeof p.target_margin === "number" ? p.target_margin : undefined;
    const low = margin?.low?.net_margin;
    if (typeof low === "number" && typeof target === "number" && low < target) {
      result.warnings.push("利润对退货率与国际运费敏感:悲观档低于目标利润率,建议封顶 Watch");
      result.flags.push("margin.low<target");
      result.evidence.push({
        label: "利润敏感",
        value: `⚠ 悲观档 ${(low * 100).toFixed(0)}% < 目标 ${(target * 100).toFixed(0)}%`,
      });
      result.risk_level = maxLevel(result.risk_level, "medium");
    }
    return result;
  }

  if (stage === "listing" || stage === "packaging") {
    const texts: string[] = [];
    if (typeof p.title === "string") texts.push(p.title);
    if (typeof p.description === "string") texts.push(p.description);
    if (Array.isArray(p.bullet_points)) texts.push(...(p.bullet_points as string[]));
    if (typeof p.prompt === "string") texts.push(p.prompt);
    scanClaims(result, texts.join("\n"), stage === "packaging" ? "image prompt" : "listing");

    const category = (p.category as string) ?? (p.brief as { category?: string })?.category;
    if (isElectrical(category)) {
      result.human_review_required = true;
      result.warnings.push("USB/电器类:需核对供电与安全信息,不暗示安全认证,launch 前人工复核");
      result.flags.push("electrical_safety_review");
      result.evidence.push({ label: "电器安全", value: "⚠ USB 供电电器,需人工复核(rule: sg-electrical-safety-review)" });
      result.risk_level = maxLevel(result.risk_level, "medium");
    }

    // Counterfeit / IP — hard block (rule: sg-prohibited-counterfeit-ip).
    const brand = typeof p.brand === "string" ? p.brand.toLowerCase().trim() : "";
    const PROTECTED = ["dyson", "xiaomi", "apple", "shark"];
    if (brand && PROTECTED.includes(brand)) {
      result.hard_block = true;
      result.human_review_required = true;
      result.warnings.push(`疑似使用受保护品牌「${brand}」,需授权,否则禁止上架`);
      result.flags.push("prohibited_brand_ip");
      result.evidence.push({ label: "品牌/IP", value: `⛔ 受保护品牌 ${brand}(rule: sg-prohibited-counterfeit-ip)` });
      result.risk_level = "high";
    }
    return result;
  }

  // committee stage: hard gates are applied in committee (#14); checkpoint is a passthrough record.
  return result;
}
