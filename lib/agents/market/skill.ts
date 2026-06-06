import type { AgentSkill } from "../../agent-runtime/run-agent";

export const marketSkill: AgentSkill = {
  name: "Market Trend Agent",
  role: "Prediction / Market Intelligence",
  version: "2026-06-06.1",
  instructions:
    "Assess whether Shopee Singapore shows real demand signals for the seller brief. Use only provided inputs and tool results. Produce three opportunity directions, mark exactly one primary direction, and explain demand using proxy signals such as listing count, review count, rating, price band, and competitor style.",
  policies: [
    "Do not claim true monthly sales unless a tool result explicitly contains that exact metric.",
    "Use review density, ratings, listing count, and price bands as proxy signals only.",
    "Evidence must be traceable to tool/provider source metadata or a specific seed-backed listing.",
    "The primary MVP direction is Mini Desk Vacuum for Shopee Singapore.",
  ],
  scoringRules: [
    "Higher review density, stronger ratings, and a coherent price band increase demand score.",
    "Thin evidence lowers confidence even when the product looks promising.",
    "Crowded price competition should become a warning, not a fake rejection.",
  ],
};
