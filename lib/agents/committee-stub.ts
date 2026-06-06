// Committee Agent — STUB slice for TASK-API-INTEGRATION (#15).
//
// Per the #15 plan: the integration layer develops against stub agents that
// return mock-result.json-shaped slices from day one. "Integration" = swap this
// stub for the real import once TASK-COMMITTEE (#14) lands — change the import in
// lib/agents/orchestrate.ts, delete this file. The real committee agent decides
// Go/Watch/Reject via LLM (see [[committee-pure-llm-verdict]]); this stub only
// produces a deterministic, schema-valid Committee slice so the pipeline runs end
// to end and the frontend has real data to render.
//
// It runs LAST-but-one (before risk) so its checkpoint is folded into the risk
// aggregate, mirroring the real wiring.

import type { AgentResult, Committee, Opportunity, Tradeoff } from "../../contract/result";
import type { Agent } from "./contracts";

const COMMITTEE_WEIGHTS: Committee["weights"] = {
  profit: 0.3,
  demand: 0.25,
  compliance: 0.2,
  fulfillment: 0.15,
  packaging: 0.1,
};

function rankByOverall(opportunities: Opportunity[]): Opportunity[] {
  return [...opportunities].sort((a, b) => b.scores.overall - a.scores.overall);
}

export const committeeAgent: Agent = async (ctx) => {
  const opportunities = ctx.results.opportunities ?? [];
  const ranked = rankByOverall(opportunities);
  const primary = opportunities.find((o) => o.is_primary) ?? ranked[0];

  const tradeoffs: Tradeoff[] = ranked
    .filter((o) => o.id !== primary?.id)
    .map((o) => ({
      opportunity_id: o.id,
      conflict: `${o.market_heat} 需求 + ${o.risk_level} 合规风险 + ${o.decision} 倾向`,
      resolution: o.decision_reason || `${o.decision}:依据利润/风险评分综合排序`,
    }));

  const committee: Committee = {
    ranked_ids: ranked.map((o) => o.id),
    weights: COMMITTEE_WEIGHTS,
    tradeoffs,
    summary: primary
      ? `推荐先以 ${primary.name} 起步(${primary.decision});其余机会按风险与利润评分排序,谨慎测试。`
      : "无可评估机会。",
  };

  await ctx.risk.checkpoint("committee", {
    ranked_ids: committee.ranked_ids,
    primary_id: primary?.id,
    primary_decision: primary?.decision,
  });

  const agent: AgentResult = {
    key: "committee",
    name: "Investment Committee (stub)",
    role: "Decision Synthesis",
    status: "done",
    inputs_summary: `${opportunities.length} 个机会按加权评分排序`,
    data_sources: ["margin agent", "risk agent", "listing agent", "packaging agent"],
    evidence: ranked
      .slice(0, 3)
      .map((o) => ({ label: o.name, value: `${o.decision} · overall ${o.scores.overall}` })),
    key_judgment: committee.summary,
    score: primary?.scores.overall ?? 0,
    confidence: 0.5,
    warnings: [
      "Committee verdict is a #15 stub slice; swap for the TASK-COMMITTEE agent once #14 merges.",
    ],
  };

  return { agents: [agent], committee };
};
