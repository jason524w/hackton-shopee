import { describe, expect, it } from "vitest";
import mock from "../../../../contract/mock-result.json";
import type { AgentContext } from "../../contracts";
import { createNoopRisk } from "../../contracts";
import { createRiskSupervisor } from "../../risk/checkpoints";
import { marginAgent } from "../index";

function baseCtx(risk = createNoopRisk()): AgentContext {
  const primary = mock.opportunities.find((o) => o.is_primary)!;
  return {
    brief: mock.brief as AgentContext["brief"],
    results: {
      currency: "SGD",
      // strip upstream-computed margin so the agent recomputes it
      opportunities: [{ ...primary, margin: null }] as never,
    },
    providers: {} as never,
    risk,
  };
}

describe("marginAgent", () => {
  it("computes the margin detail and attaches it to the primary opportunity", async () => {
    const slice = await marginAgent(baseCtx());
    const opp = slice.opportunities?.[0];
    expect(opp?.margin?.base.net_margin).toBeGreaterThan(0.27);
    expect(opp?.margin?.low.net_margin).toBeLessThan(0.14);
    expect(opp?.minimum_viable_price).toBeGreaterThan(0);
  });

  it("emits a sensitivity warning because low < target (demo)", async () => {
    const slice = await marginAgent(baseCtx());
    const agent = slice.agents?.find((a) => a.key === "margin");
    expect(agent?.warnings.join("")).toMatch(/敏感|低于目标/);
    expect(agent?.confidence).toBeLessThan(0.8);
  });

  it("records a margin checkpoint on the risk supervisor", async () => {
    const sup = createRiskSupervisor();
    await marginAgent(baseCtx(sup));
    const cps = sup.getCheckpoints();
    expect(cps).toHaveLength(1);
    expect(cps[0].stage).toBe("margin");
    expect(cps[0].flags).toContain("margin.low<target");
  });
});
