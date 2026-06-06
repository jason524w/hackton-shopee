// Deterministic evidence assembly + deterministic decision.
// - buildEvidence: structured signals fed to the LLM (and shown in the UI).
// - deterministicOutput: the fixture (dry-run) output AND the live-failure fallback.
// Both are pure; they do NOT call the LLM. See docs/design/committee.md §2/§4.

import type { Brief, Decision, Opportunity, SelectedListing, Tradeoff } from "../../../contract/result";
import type { AgentContext } from "../contracts";
import { fallbackDecision, type FallbackSignals } from "./gates";
import type { CandidateEvidence, CommitteeAgentInput, CommitteeOutput } from "./schema";
import { computeOverall } from "./weights";

const SEVERITY: Record<Decision, number> = { Go: 2, Watch: 1, Reject: 0 };

// Compliance/risk warnings as seen WHEN committee runs. The risk AgentResult is
// aggregated AFTER committee in the pipeline, so it usually does not exist yet —
// take warnings from the recorded checkpoints + selected_listing.compliance (both
// populated upstream), folding in the risk AgentResult only if it happens to exist.
function riskWarnings(ctx: AgentContext): string[] {
  const fromCheckpoints = ctx.risk.getCheckpoints().flatMap((c) => c.warnings);
  const fromListing = ctx.results.selected_listing?.compliance.warnings ?? [];
  const fromAgent = ctx.results.agents?.find((a) => a.key === "risk")?.warnings ?? [];
  return Array.from(new Set([...fromCheckpoints, ...fromListing, ...fromAgent]));
}

/** Primary-only signals come from the selected listing + risk checkpoints. */
function signalsFor(o: Opportunity, ctx: AgentContext): FallbackSignals {
  if (!o.is_primary) {
    return { checkpoints: [], missingFields: false, imagesRejected: false };
  }
  const sl: SelectedListing | undefined = ctx.results.selected_listing;
  return {
    checkpoints: ctx.risk.getCheckpoints(),
    missingFields: (sl?.shopee.missing_fields.length ?? 0) > 0,
    imagesRejected: sl?.images.some((i) => i.compliance === "rejected") ?? false,
  };
}

export function buildEvidence(opps: Opportunity[], ctx: AgentContext): CommitteeAgentInput {
  const brief = ctx.brief;
  const sl: SelectedListing | undefined = ctx.results.selected_listing;
  const checkpoints = ctx.risk.getCheckpoints();
  const warnings = riskWarnings(ctx);

  const candidates: CandidateEvidence[] = opps.map((o) => ({
    id: o.id,
    name: o.name,
    is_primary: o.is_primary,
    overall: computeOverall(o.scores),
    scores: o.scores,
    gross_margin: o.gross_margin,
    risk_level: o.risk_level,
    fulfillment_days: o.fulfillment_days,
    max_fulfillment_days: brief.max_fulfillment_days,
    stock_status: o.stock_status,
    margin_low_net_margin: o.margin ? o.margin.low.net_margin : null,
    target_margin: brief.target_margin,
    risk_warnings: o.is_primary ? warnings : [],
    hard_block: o.is_primary ? checkpoints.some((c) => c.hard_block) : false,
    human_review_required: o.is_primary
      ? (sl?.compliance.human_review_required ?? checkpoints.some((c) => c.human_review_required))
      : false,
  }));

  return { brief, candidates };
}

function rankIds(decided: { id: string; verdict: Decision; overall: number }[]): string[] {
  return [...decided]
    .sort((a, b) => SEVERITY[b.verdict] - SEVERITY[a.verdict] || b.overall - a.overall)
    .map((d) => d.id);
}

/** Deterministic committee output — used as runAgent fixture and live-failure fallback. */
export function deterministicOutput(opps: Opportunity[], ctx: AgentContext): CommitteeOutput {
  const brief: Brief = ctx.brief;
  const warnings = riskWarnings(ctx);

  const decided = opps.map((o) => {
    const { decision, reasons } = fallbackDecision(o, brief, signalsFor(o, ctx));
    // For the primary, weave in compliance/human-review from risk warnings so the
    // reason mentions both profit sensitivity AND compliance (roadmap §8.7).
    const complianceNotes = o.is_primary ? warnings : [];
    return { o, decision, reasons: [...reasons, ...complianceNotes], overall: computeOverall(o.scores) };
  });

  const decisions = decided.map(({ o, decision, reasons }) => ({
    id: o.id,
    verdict: decision,
    decision_reason:
      reasons.length > 0 ? reasons.join(";") : `综合评分达标(${computeOverall(o.scores)}),无封顶项 → ${decision}`,
    key_reasons: reasons.slice(0, 3),
  }));

  const tradeoffs: Tradeoff[] = decided
    .filter(({ decision }) => decision !== "Go")
    .map(({ o, decision, reasons }) => ({
      opportunity_id: o.id,
      conflict: reasons.slice(0, 2).join(" + ") || `${decision} 项`,
      resolution: decision === "Reject" ? "不建议上架" : "Watch:小批量测试,规避风险后再放量",
    }));

  const ranked = rankIds(decided.map(({ o, decision, overall }) => ({ id: o.id, verdict: decision, overall })));
  const top = decisions.find((d) => d.id === ranked[0]);
  const summary = `推荐顺序:${ranked.join(" > ")}。首选 ${top?.id ?? "-"}(${top?.verdict ?? "-"});其余按风险与利润敏感度封顶或拒绝。`;

  return { decisions, ranked_ids: ranked, tradeoffs, summary };
}
