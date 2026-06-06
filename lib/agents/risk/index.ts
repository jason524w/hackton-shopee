// Risk Agent — runs last in the pipeline. It does not re-scan; it aggregates the
// checkpoints recorded by the supervisor during margin/listing/packaging/committee
// into one Risk AgentResult. The supervisor itself is created by createRiskSupervisor
// (checkpoints.ts) and injected into AgentContext.risk by the API layer (#15).

import type { Agent } from "../contracts";
import { aggregateRisk } from "./aggregate";

export { createRiskSupervisor } from "./checkpoints";
export { aggregateRisk } from "./aggregate";

export const riskAgent: Agent = async (ctx) => {
  const checkpoints = ctx.risk.getCheckpoints();
  return { agents: [aggregateRisk(checkpoints)] };
};
