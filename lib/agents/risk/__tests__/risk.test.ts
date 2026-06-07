import { describe, expect, it } from "vitest";
import { findBannedClaims } from "../claims";
import { runDeterministic } from "../deterministic";
import { mergeRisk } from "../merge";
import { createRiskSupervisor } from "../checkpoints";
import { aggregateRisk } from "../aggregate";

describe("claims matcher (deterministic, demo-load-bearing)", () => {
  it("catches exaggerated suction claims case-insensitively", () => {
    expect(findBannedClaims("This SUPER Suction vacuum is industrial-grade")).toHaveLength(2);
    expect(findBannedClaims("超强吸力,工业级")).toHaveLength(2);
  });
  it("returns nothing for clean copy", () => {
    expect(findBannedClaims("Compact USB desk vacuum for crumbs")).toHaveLength(0);
  });
});

describe("deterministic pre-check", () => {
  it("margin stage flags low < target as sensitive (Watch signal)", () => {
    const r = runDeterministic("margin", {
      margin: { low: { net_margin: 0.12 } },
      target_margin: 0.25,
    });
    expect(r.flags).toContain("margin.low<target");
    expect(r.risk_level).toBe("medium");
    expect(r.hard_block).toBe(false);
  });

  it("listing stage: electrical category -> human review (no LLM needed)", () => {
    const r = runDeterministic("listing", {
      title: "Mini Desk Vacuum USB",
      category: "home_appliances_small",
    });
    expect(r.human_review_required).toBe(true);
    expect(r.flags).toContain("electrical_safety_review");
  });

  it("listing stage: protected brand -> hard block", () => {
    const r = runDeterministic("listing", { title: "vac", brand: "Dyson" });
    expect(r.hard_block).toBe(true);
    expect(r.risk_level).toBe("high");
  });
});

describe("merge — union, LLM can only add risk", () => {
  it("unions findings and never lets LLM clear a hard block", () => {
    const det = runDeterministic("listing", { title: "x", brand: "dyson" });
    const merged = mergeRisk(det, { risk_level: "low", warnings: ["llm note"] });
    expect(merged.hard_block).toBe(true); // LLM cannot suppress
    expect(merged.warnings).toContain("llm note");
    expect(merged.risk_level).toBe("high");
  });
});

describe("supervisor is degradable", () => {
  it("swallows a throwing LLM reviewer and keeps deterministic findings", async () => {
    const sup = createRiskSupervisor({
      llmReviewer: async () => {
        throw new Error("LLM down");
      },
    });
    const cp = await sup.checkpoint("margin", { margin: { low: { net_margin: 0.1 } }, target_margin: 0.25 });
    expect(cp.flags).toContain("margin.low<target"); // deterministic still there
  });
});

describe("Mini Desk Vacuum — full risk outcome via supervisor + aggregate", () => {
  it("medium / human_review / two warnings, no hard block (demo climax)", async () => {
    const sup = createRiskSupervisor();
    await sup.checkpoint("margin", { margin: { low: { net_margin: 0.124 } }, target_margin: 0.25 });
    await sup.checkpoint("listing", {
      title: "Mini Desk Vacuum (USB, cordless)",
      description: "Compact cordless desk cleaner with super suction for crumbs",
      category: "home_appliances_small",
      brand: "",
    });

    const agent = aggregateRisk(sup.getCheckpoints());
    expect(agent.key).toBe("risk");
    expect(agent.risk_level).toBe("medium");
    expect(agent.status).toBe("done");
    // human review from electrical, plus exaggerated-suction + sensitivity warnings
    const result = { human_review: sup.getCheckpoints().some((c) => c.human_review_required) };
    expect(result.human_review).toBe(true);
    expect(agent.warnings.length).toBeGreaterThanOrEqual(2);
    expect(agent.warnings.join(" ")).toMatch(/吸力|夸大|super suction/i);
  });

  it("REAL pipeline payload shapes still trigger both red lines (GAP-5 regression)", async () => {
    // The live listing/packaging agents do NOT send {title, description...} —
    // they send selection/prompts/selling_copy shapes. The deterministic layer
    // must still produce 电器安全 + 夸大 guidance for the vacuum demo.
    const sup = createRiskSupervisor();
    await sup.checkpoint("listing", {
      purpose: "rank_filter_before_packaging_handoff",
      category: "home_appliances_small",
      selection: { ranked_ids: ["dir_1"] },
    });
    await sup.checkpoint("packaging", {
      category: "home_appliances_small",
      prompts: [{ type: "hero", prompt: "Desk vacuum with super suction on a clean desk" }],
      selling_copy: { item_name: "Mini Desk Vacuum", bullet_points: ["industrial-grade power"] },
    });

    const agent = aggregateRisk(sup.getCheckpoints());
    expect(agent.risk_level).toBe("medium");
    const joined = agent.warnings.join(" ");
    expect(joined).toMatch(/电器|USB/);
    expect(joined).toMatch(/夸大/);
    expect(sup.getCheckpoints().some((c) => c.human_review_required)).toBe(true);
    // claims scan saw nested prompt + selling copy text
    expect(sup.getCheckpoints().flatMap((c) => c.flags)).toEqual(
      expect.arrayContaining(["electrical_safety_review", "exaggeration_guidance"]),
    );
    expect(joined).toMatch(/super suction|industrial/i);
  });
});
