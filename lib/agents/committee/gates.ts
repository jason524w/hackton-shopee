// Deterministic fallback decision — used ONLY when the LLM committee is
// unavailable (timeout/offline). The LLM normally decides the verdict (pure-A);
// this reproduces the demo outcome so a degraded run is still correct.
// See docs/design/committee.md §4. human_review is deliberately NOT a gate.

import type { Brief, Decision, Opportunity } from "../../../contract/result";
import type { RiskCheckpoint } from "../contracts";
import { computeOverall } from "./weights";

export interface FallbackSignals {
  checkpoints: RiskCheckpoint[]; // from ctx.risk.getCheckpoints() (primary's pipeline)
  missingFields: boolean; // primary listing not ready
  imagesRejected: boolean; // primary image compliance === "rejected"
}

const SEVERITY: Record<Decision, number> = { Go: 2, Watch: 1, Reject: 0 };

/** Cap a decision so it cannot be more permissive than `cap` (never raises). */
function capTo(decision: Decision, cap: Decision): Decision {
  return SEVERITY[decision] <= SEVERITY[cap] ? decision : cap;
}

export function baseDecision(overall: number): Decision {
  return overall >= 70 ? "Go" : overall >= 50 ? "Watch" : "Reject";
}

export function fallbackDecision(
  o: Opportunity,
  brief: Brief,
  sig: FallbackSignals,
): { decision: Decision; reasons: string[] } {
  let decision = baseDecision(computeOverall(o.scores));
  const reasons: string[] = [];

  // Gate A — hard reject (covers everything).
  if (o.risk_level === "high") {
    decision = "Reject";
    reasons.push("合规/安全风险等级高");
  }
  if (sig.checkpoints.some((c) => c.hard_block)) {
    decision = "Reject";
    reasons.push("硬性违规(品牌/IP 或禁售)");
  }
  if (o.is_primary && sig.imagesRejected) {
    decision = "Reject";
    reasons.push("图文不符被判违规");
  }
  if (o.stock_status === "out") {
    decision = "Reject";
    reasons.push("无可用库存,无可行履约");
  }

  // Gate B — cap to Watch (never raises a Reject).
  if (o.is_primary && o.margin && o.margin.low.net_margin < brief.target_margin) {
    decision = capTo(decision, "Watch");
    reasons.push(
      `利润对退货/运费敏感:悲观档 ${(o.margin.low.net_margin * 100).toFixed(0)}% < 目标 ${(brief.target_margin * 100).toFixed(0)}%`,
    );
  }
  if (o.fulfillment_days > brief.max_fulfillment_days) {
    decision = capTo(decision, "Watch");
    reasons.push(`履约 ${o.fulfillment_days}d 超平台上限 ${brief.max_fulfillment_days}d`);
  }
  if (o.is_primary && sig.missingFields) {
    decision = capTo(decision, "Watch");
    reasons.push("listing 关键字段缺失,尚未 ready");
  }

  return { decision, reasons };
}
