// Weighted scoring for the committee. Deterministic — feeds the LLM as evidence,
// powers the fallback decision, and is shown in the UI. It does NOT decide the
// verdict (the LLM does, see docs/design/committee.md §0).

import type { OpportunityScores } from "../../../contract/result";

export const COMMITTEE_WEIGHTS = {
  profit: 0.3,
  demand: 0.25,
  compliance: 0.2,
  fulfillment: 0.15,
  packaging: 0.1,
} as const;

/** Weighted overall score 0..100, rounded to an integer. */
export function computeOverall(scores: OpportunityScores): number {
  const w = COMMITTEE_WEIGHTS;
  const raw =
    scores.profit * w.profit +
    scores.demand * w.demand +
    scores.compliance * w.compliance +
    scores.fulfillment * w.fulfillment +
    scores.packaging * w.packaging;
  return Math.round(raw);
}
