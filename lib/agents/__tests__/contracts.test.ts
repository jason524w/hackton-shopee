import { describe, expect, it } from "vitest";

import type { AgentResult, Brief } from "../../../contract/result";
import { createNoopRisk, runPipeline, type AgentContext } from "../contracts";

const brief: Brief = {
  target_market: "Singapore",
  target_platform: "Shopee",
  seller_type: "individual_dropshipper",
  product_intent: "mini desk vacuum",
  category: "home_appliances_small",
  budget: 500,
  target_margin: 0.25,
  max_fulfillment_days: 12,
  risk_appetite: "balanced",
  language: "en",
};

function ctx(): AgentContext {
  return {
    brief,
    results: {},
    providers: {} as AgentContext["providers"],
    risk: createNoopRisk(),
  };
}

function agentResult(overrides: Partial<AgentResult> = {}): AgentResult {
  const base: AgentResult = {
    key: "market",
    name: "Market Trend Agent",
    role: "Find demand and competitor evidence",
    status: "done",
    inputs_summary: "Singapore Shopee mini desk vacuum",
    data_sources: ["Shopee seed search", "browser snapshot"],
    evidence: [{ label: "Competitors", value: "37 listings" }],
    key_judgment: "Demand exists, but differentiation is required.",
    audit_summary: "",
    score: 78,
    confidence: 0.74,
    warnings: ["Competition is dense."],
  };

  return {
    ...base,
    ...overrides,
    audit_summary: overrides.audit_summary ?? base.audit_summary,
  };
}

describe("runPipeline agent audit summaries", () => {
  it("adds a concise English audit summary after each agent slice", async () => {
    const result = await runPipeline(
      [
        async () => ({
          agents: [agentResult()],
        }),
      ],
      ctx(),
    );

    expect(result.results.agents?.[0].audit_summary).toContain("Tools: Shopee seed search");
    expect(result.results.agents?.[0].audit_summary).toContain("Found: Demand exists");
    expect(result.results.agents?.[0].audit_summary).toContain("Action: Market Trend Agent processed");
    expect(result.results.agents?.[0].audit_summary).toContain("Output: done, score 78/100");
  });

  it("normalizes any agent-supplied audit summary from the final AgentResult", async () => {
    const result = await runPipeline(
      [
        async () => ({
          agents: [agentResult({ audit_summary: "Tools: custom. Found: custom. Action: custom. Output: custom." })],
        }),
      ],
      ctx(),
    );

    expect(result.results.agents?.[0].audit_summary).not.toBe(
      "Tools: custom. Found: custom. Action: custom. Output: custom.",
    );
    expect(result.results.agents?.[0].audit_summary).toContain("Tools: Shopee seed search");
  });
});
