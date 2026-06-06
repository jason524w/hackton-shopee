// Margin Agent — wraps the deterministic calculator as a pipeline Agent.
// Reads the primary opportunity (from market/sourcing) out of ctx.results,
// computes the cost waterfall, runs the margin risk checkpoint, and returns
// the opportunity + AgentResult slice. Code does all arithmetic; no LLM here.

import type { AgentResult, Opportunity } from "../../../contract/result";
import type { Agent } from "../contracts";
import { BASE_ASSUMPTIONS, HIGH_ASSUMPTIONS, LOW_ASSUMPTIONS } from "./assumptions";
import { computeMargin } from "./calculator";

function pickPrimary(opps: Opportunity[]): Opportunity | undefined {
  return opps.find((o) => o.is_primary) ?? opps[0];
}

function pct(n: number): string {
  return `${Math.round(n * 1000) / 10}%`;
}

/** Profit score 0..100: how the base margin compares to target, penalised for downside. */
function profitScore(baseMargin: number, lowMargin: number, target: number): number {
  const base = Math.min(1, baseMargin / Math.max(target, 0.01)); // 1.0 == hits target
  const downside = Math.max(0, Math.min(1, lowMargin / Math.max(target, 0.01)));
  const score = 100 * (0.7 * base + 0.3 * downside);
  return Math.round(Math.max(0, Math.min(100, score)));
}

export const marginAgent: Agent = async (ctx) => {
  const primary = pickPrimary(ctx.results.opportunities ?? []);
  if (!primary) {
    throw new Error("marginAgent: no opportunity in ctx.results — market/sourcing must run first");
  }

  const target = ctx.brief.target_margin;
  const { minimum_viable_price, ...marginDetail } = computeMargin({
    sellingPrice: primary.suggested_price,
    base: BASE_ASSUMPTIONS,
    low: LOW_ASSUMPTIONS,
    high: HIGH_ASSUMPTIONS,
    targetMargin: target,
  });

  const sensitive = marginDetail.low.net_margin < target;

  // Hand the numbers to the risk supervisor's margin checkpoint.
  await ctx.risk.checkpoint("margin", {
    opportunity_id: primary.id,
    margin: marginDetail,
    target_margin: target,
  });

  const warnings: string[] = [];
  if (sensitive) {
    warnings.push("利润对退货率与国际运费敏感:悲观档低于目标利润率");
  }

  const updatedPrimary: Opportunity = {
    ...primary,
    margin: marginDetail,
    minimum_viable_price,
    scores: {
      ...primary.scores,
      profit: profitScore(marginDetail.base.net_margin, marginDetail.low.net_margin, target),
    },
  };

  const agent: AgentResult = {
    key: "margin",
    name: "Margin Agent",
    role: "扣完全部成本后判断真实利润空间",
    status: "done",
    inputs_summary: `sell ${ctx.results.currency ?? "SGD"} ${primary.suggested_price} · target ${pct(target)}`,
    data_sources: ["deterministic cost model"],
    evidence: [
      { label: "建议售价", value: `${primary.suggested_price}` },
      { label: "净利率(base)", value: pct(marginDetail.base.net_margin) },
      { label: "净利率(悲观)", value: pct(marginDetail.low.net_margin) },
      { label: "最低可行售价(达标价)", value: `${minimum_viable_price}` },
    ],
    key_judgment: sensitive
      ? `base 档利润成立(${pct(marginDetail.base.net_margin)});但悲观档掉到 ${pct(marginDetail.low.net_margin)},低于目标 ${pct(target)},利润对退货与运费敏感。`
      : `各档均达标,利润空间稳健。`,
    audit_summary: "",
    score: profitScore(marginDetail.base.net_margin, marginDetail.low.net_margin, target),
    confidence: sensitive ? 0.62 : 0.85,
    warnings,
  };

  return { opportunities: [updatedPrimary], agents: [agent] };
};
