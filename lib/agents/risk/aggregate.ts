// Aggregate all recorded checkpoints into the single Risk AgentResult that the
// contract/War Room expects. See docs/design/margin-risk.md §4.

import type { AgentResult, Evidence, RiskLevel } from "../../../contract/result";
import type { RiskCheckpoint } from "../contracts";

function maxLevel(levels: RiskLevel[]): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high"];
  return order[Math.max(0, ...levels.map((l) => order.indexOf(l)))];
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

// risk score 0..100: higher == safer. Drops with level, human review, hard block.
function riskScore(level: RiskLevel, humanReview: boolean, hardBlock: boolean): number {
  let score = level === "high" ? 35 : level === "medium" ? 58 : 82;
  if (humanReview) score -= 8;
  if (hardBlock) score = Math.min(score, 20);
  return Math.max(0, Math.min(100, score));
}

export function aggregateRisk(checkpoints: RiskCheckpoint[]): AgentResult {
  const riskLevel = maxLevel(checkpoints.map((c) => c.risk_level));
  const humanReview = checkpoints.some((c) => c.human_review_required);
  const hardBlock = checkpoints.some((c) => c.hard_block);
  const warnings = uniq(checkpoints.flatMap((c) => c.warnings));
  const evidence: Evidence[] = checkpoints.flatMap((c) => c.evidence);
  const stagesRun = checkpoints.map((c) => c.stage);

  const keyJudgment = hardBlock
    ? "存在硬性违规(品牌/IP 等),禁止上架。"
    : humanReview
      ? "无硬性拦截,但属电器类且存在夸大宣传风险,需人工复核。"
      : "未发现显著风险。";

  return {
    key: "risk",
    name: "Risk & Compliance Agent",
    role: "检查平台、商品、履约与内容风险",
    status: hardBlock ? "blocked" : "done",
    inputs_summary: `checkpoints: ${stagesRun.join(", ") || "none"}`,
    data_sources: ["Shopee prohibited & listing-violation rules (seed)"],
    evidence: evidence.length ? evidence : [{ label: "风险扫描", value: "通过" }],
    key_judgment: keyJudgment,
    score: riskScore(riskLevel, humanReview, hardBlock),
    confidence: 0.8,
    warnings,
    risk_level: riskLevel,
  };
}
