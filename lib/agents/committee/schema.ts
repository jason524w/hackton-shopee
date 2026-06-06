// Committee LLM input (evidence) + output (verdict) types and Structured Output schema.
// The LLM decides the verdict (pure-A); the schema forces strict JSON. See
// docs/design/committee.md §3.

import type { Brief, Decision, OpportunityScores, RiskLevel, Tradeoff } from "../../../contract/result";
import type { JsonSchema } from "../../agent-runtime/schemas";
import { makeObjectSchema } from "../../agent-runtime/schemas";

export interface CandidateEvidence {
  id: string;
  name: string;
  is_primary: boolean;
  overall: number;
  scores: OpportunityScores;
  gross_margin: number;
  risk_level: RiskLevel;
  fulfillment_days: number;
  max_fulfillment_days: number;
  stock_status: string;
  // primary-only signals (null/empty otherwise)
  margin_low_net_margin: number | null;
  target_margin: number;
  risk_warnings: string[];
  hard_block: boolean;
  human_review_required: boolean;
}

export interface CommitteeAgentInput {
  brief: Brief;
  candidates: CandidateEvidence[];
}

export interface CommitteeDecisionOut {
  id: string;
  verdict: Decision;
  decision_reason: string;
  key_reasons: string[];
}

export interface CommitteeOutput {
  decisions: CommitteeDecisionOut[];
  ranked_ids: string[];
  tradeoffs: Tradeoff[];
  summary: string;
}

export const COMMITTEE_OUTPUT_SCHEMA: JsonSchema = makeObjectSchema({
  decisions: {
    type: "array",
    items: makeObjectSchema({
      id: { type: "string" },
      verdict: { type: "string", enum: ["Go", "Watch", "Reject"] },
      decision_reason: { type: "string" },
      key_reasons: { type: "array", items: { type: "string" } },
    }),
  },
  ranked_ids: { type: "array", items: { type: "string" } },
  tradeoffs: {
    type: "array",
    items: makeObjectSchema({
      opportunity_id: { type: "string" },
      conflict: { type: "string" },
      resolution: { type: "string" },
    }),
  },
  summary: { type: "string" },
});
