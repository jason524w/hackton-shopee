// Union-merge of the deterministic pre-check and the optional LLM review.
// Mirrors UpUp's merge_risk_results: take the union of findings so the LLM can
// only ADD risk, never suppress a deterministic finding. See docs/design/margin-risk.md §4.

import type { Evidence, RiskLevel } from "../../../contract/result";
import type { DeterministicResult } from "./deterministic";

export interface LlmRiskFindings {
  warnings?: string[];
  flags?: string[];
  evidence?: Evidence[];
  human_review_required?: boolean;
  risk_level?: RiskLevel;
}

export interface MergedRisk {
  risk_level: RiskLevel;
  human_review_required: boolean;
  hard_block: boolean;
  warnings: string[];
  evidence: Evidence[];
  flags: string[];
}

function maxLevel(a: RiskLevel, b: RiskLevel): RiskLevel {
  const order: RiskLevel[] = ["low", "medium", "high"];
  return order[Math.max(order.indexOf(a), order.indexOf(b))];
}

function uniq(values: string[]): string[] {
  return Array.from(new Set(values));
}

export function mergeRisk(det: DeterministicResult, llm?: LlmRiskFindings | null): MergedRisk {
  return {
    risk_level: maxLevel(det.risk_level, llm?.risk_level ?? "low"),
    human_review_required: det.human_review_required || Boolean(llm?.human_review_required),
    hard_block: det.hard_block, // only deterministic rules can hard-block
    warnings: uniq([...det.warnings, ...(llm?.warnings ?? [])]),
    evidence: [...det.evidence, ...(llm?.evidence ?? [])],
    flags: uniq([...det.flags, ...(llm?.flags ?? [])]),
  };
}
