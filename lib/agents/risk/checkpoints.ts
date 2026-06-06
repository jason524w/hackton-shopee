// Real RiskSupervisor — replaces createNoopRisk() in the live pipeline.
// #15 injects this into AgentContext.risk; margin/listing/packaging/committee
// agents call ctx.risk.checkpoint(stage, payload) as they run.

import type { RiskCheckpoint, RiskCheckpointStage, RiskSupervisor } from "../contracts";
import { runDeterministic } from "./deterministic";
import { mergeRisk, type LlmRiskFindings } from "./merge";

export type LlmReviewer = (
  stage: RiskCheckpointStage,
  payload: unknown,
) => Promise<LlmRiskFindings | null>;

export interface RiskSupervisorOptions {
  // Optional LLM reviewer for fuzzy claims. Degradable: any throw is swallowed,
  // the deterministic layer still stands. Demo never breaks on a live LLM hiccup.
  llmReviewer?: LlmReviewer;
}

function clone(cp: RiskCheckpoint): RiskCheckpoint {
  return {
    ...cp,
    warnings: [...cp.warnings],
    evidence: cp.evidence.map((e) => ({ ...e })),
    flags: [...cp.flags],
  };
}

export function createRiskSupervisor(options: RiskSupervisorOptions = {}): RiskSupervisor {
  const checkpoints: RiskCheckpoint[] = [];

  return {
    async checkpoint(stage: RiskCheckpointStage, payload: unknown): Promise<RiskCheckpoint> {
      const deterministic = runDeterministic(stage, payload);

      let llm: LlmRiskFindings | null = null;
      if (options.llmReviewer) {
        try {
          llm = await options.llmReviewer(stage, payload);
        } catch {
          llm = null; // degradable — deterministic layer is the safety net
        }
      }

      const merged = mergeRisk(deterministic, llm);
      const checkpoint: RiskCheckpoint = { stage, ...merged };
      checkpoints.push(checkpoint);
      return clone(checkpoint);
    },

    getCheckpoints(): RiskCheckpoint[] {
      return checkpoints.map(clone);
    },
  };
}
