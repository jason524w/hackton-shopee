import { describe, expect, it } from "vitest";
import mock from "../../../../contract/mock-result.json";
import type { Opportunity, RunResult, SelectedListing } from "../../../../contract/result";
import { createRiskSupervisor } from "../../risk/checkpoints";
import type { AgentContext } from "../../contracts";
import { buildEvidence, deterministicOutput } from "../evidence";
import { committeeAgent, runCommitteeAgent } from "../index";

function ctxWith(overrides: Partial<RunResult> = {}): AgentContext {
  const opps = mock.opportunities.map((o) => ({ ...o })) as unknown as Opportunity[];
  return {
    brief: mock.brief as AgentContext["brief"],
    results: {
      currency: "SGD",
      opportunities: opps,
      selected_listing: mock.selected_listing as unknown as SelectedListing,
      agents: mock.agents as RunResult["agents"],
      ...overrides,
    },
    providers: {} as never,
    risk: createRiskSupervisor(),
  };
}

describe("buildEvidence", () => {
  it("attaches primary-only signals to the primary, blanks them on others", () => {
    const { candidates } = buildEvidence(ctxWith().results.opportunities!, ctxWith());
    const primary = candidates.find((c) => c.is_primary)!;
    const other = candidates.find((c) => !c.is_primary)!;
    expect(primary.margin_low_net_margin).not.toBeNull();
    expect(primary.human_review_required).toBe(true); // selected_listing.compliance
    expect(other.margin_low_net_margin).toBeNull();
    expect(other.human_review_required).toBe(false);
  });
  it("computes overall per candidate", () => {
    const { candidates } = buildEvidence(ctxWith().results.opportunities!, ctxWith());
    expect(candidates.find((c) => c.id === "opp_cable_organizer")!.overall).toBe(71);
  });
});

describe("deterministicOutput (fixture + fallback)", () => {
  it("reproduces the demo verdicts and ranking", () => {
    const ctx = ctxWith();
    const out = deterministicOutput(ctx.results.opportunities!, ctx);
    const byId = Object.fromEntries(out.decisions.map((d) => [d.id, d.verdict]));
    expect(byId.opp_cable_organizer).toBe("Go");
    expect(byId.opp_desk_vacuum).toBe("Watch");
    expect(byId.opp_mini_dehumidifier).toBe("Reject");
    expect(out.ranked_ids).toEqual(["opp_cable_organizer", "opp_desk_vacuum", "opp_mini_dehumidifier"]);
  });
  it("vacuum reason mentions BOTH profit sensitivity and compliance/human review", () => {
    const ctx = ctxWith();
    const out = deterministicOutput(ctx.results.opportunities!, ctx);
    const reason = out.decisions.find((d) => d.id === "opp_desk_vacuum")!.decision_reason;
    expect(reason).toMatch(/利润|敏感|悲观/);
    expect(reason).toMatch(/夸大|电器|复核|USB|安全/);
  });
});

describe("committeeAgent (fixture mode)", () => {
  it("returns a slice with decisions, committee weights and ranking", async () => {
    const slice = await committeeAgent(ctxWith());
    const vacuum = slice.opportunities!.find((o) => o.id === "opp_desk_vacuum")!;
    expect(vacuum.decision).toBe("Watch");
    expect(slice.committee!.weights.profit).toBe(0.3);
    expect(slice.committee!.ranked_ids[0]).toBe("opp_cable_organizer");
    const committeeAgentResult = slice.agents!.find((a) => a.key === "committee")!;
    expect(committeeAgentResult.warnings).toHaveLength(0); // fixture is not "degraded"
  });
});

describe("risk evidence source (finding #2)", () => {
  it("surfaces compliance from checkpoints + selected_listing, not the risk AgentResult", async () => {
    // In the documented pipeline, committee runs BEFORE the risk aggregation,
    // so ctx.results.agents has NO risk entry yet. Compliance must come from the
    // checkpoints (already recorded) + selected_listing.compliance.
    const sup = createRiskSupervisor();
    await sup.checkpoint("listing", {
      title: "Mini Desk Vacuum",
      description: "cordless USB desk cleaner with super suction",
      category: "home_appliances_small",
      brand: "",
    });
    const opps = mock.opportunities.map((o) => ({ ...o })) as unknown as Opportunity[];
    const ctx: AgentContext = {
      brief: mock.brief as AgentContext["brief"],
      results: {
        currency: "SGD",
        opportunities: opps,
        selected_listing: mock.selected_listing as unknown as SelectedListing,
        agents: [], // risk AgentResult does not exist yet
      },
      providers: {} as never,
      risk: sup,
    };
    const slice = await committeeAgent(ctx);
    const reason = slice.opportunities!.find((o) => o.id === "opp_desk_vacuum")!.decision_reason;
    expect(reason).toMatch(/夸大|电器|复核|USB|安全|认证/);
  });
});

describe("degraded fallback (live LLM fails)", () => {
  it("falls back to deterministic decision and surfaces the degradation", async () => {
    // force a live call with no client/key so runAgent fails
    const { output, degraded } = await runCommitteeAgent(ctxWith(), { mode: "live" });
    expect(degraded).not.toBeNull();
    expect(output.decisions.find((d) => d.id === "opp_desk_vacuum")!.verdict).toBe("Watch");
  });
});
