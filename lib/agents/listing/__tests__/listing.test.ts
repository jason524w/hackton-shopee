import { describe, expect, it, vi } from "vitest";
import mockResult from "../../../../contract/mock-result.json";
import type { RunResult } from "../../../../contract/result";
import {
  createSeedFxProvider,
  createSeedOpenAIImageProvider,
  createSeedShippingProvider,
  createSeedShopeeProvider,
  createSeedSourcing1688Provider,
} from "../../../providers";
import { validateJsonSchema } from "../../../agent-runtime/schemas";
import type { RiskCheckpoint, RiskSupervisor } from "../../contracts";
import { buildListingInput, runListingAgent } from "../index";
import { assertOutput, replayFixture } from "../harness";
import { selectedListingSchema } from "../schema";

describe("listing ranker agent", () => {
  it("ranks and filters opportunities before Packaging handoff", async () => {
    const output = await replayFixture();

    assertOutput(output);
    expect(output.selection.ranked_ids).toEqual([
      "opp_cable_organizer",
      "opp_desk_vacuum",
      "opp_mini_dehumidifier",
    ]);
    expect(output.selection.selected_opportunity_id).toBe("opp_desk_vacuum");
    expect(output.selected_listing.opportunity_id).toBe("opp_desk_vacuum");
    expect(output.selection.filters.find((item) => item.opportunity_id === "opp_mini_dehumidifier")?.status).toBe(
      "filtered",
    );
    expect(output.agent.key).toBe("listing");
    expect(output.agent.key_judgment).toContain("upstream primary");
  });

  it("does not generate Packaging-owned images or final-ready launch claims", async () => {
    const output = await replayFixture();
    const text = [
      output.selected_listing.shopee.item_name,
      output.selected_listing.shopee.description,
      ...output.selected_listing.shopee.bullet_points,
    ]
      .join(" ")
      .toLowerCase();

    expect(output.selected_listing.images).toEqual([]);
    expect(text).not.toContain("super suction");
    expect(text).not.toContain("industrial grade");
    expect(text).not.toContain("certified safety");
    expect(text).not.toContain("guaranteed deep cleaning");
    expect(output.selected_listing.compliance.warnings.join(" ")).toContain("Packaging Agent");
    expect(output.selected_listing.editable_json_ready).toBe(false);
  });

  it("uses provider evidence and calls listing risk checkpoint", async () => {
    const risk = createSpyRisk();
    const ctx = createFixtureContext(risk);
    const result = await runListingAgent(ctx, { mode: "fixture", runId: "run_listing_test" });

    expect(risk.checkpoint).toHaveBeenCalledWith(
      "listing",
      expect.objectContaining({
        purpose: "rank_filter_before_packaging_handoff",
        selection: expect.objectContaining({ selected_opportunity_id: "opp_desk_vacuum" }),
        feature_vectors: expect.any(Array),
      }),
    );
    expect(result.selected_listing?.shopee.price).toBe(11.9);
    expect(result.selected_listing?.shopee.required_fields_filled).toBe(
      result.selected_listing?.shopee.required_fields_total,
    );
    expect(result.selected_listing?.editable_json_ready).toBe(false);
    expect(result.opportunities).toBeUndefined();
  });

  it("keeps Market-owned primary flags out of the Listing slice", async () => {
    const risk = createSpyRisk();
    const result = cloneRunResult(mockResult as RunResult);
    result.opportunities = result.opportunities.map((opportunity) => ({
      ...opportunity,
      is_primary: opportunity.id === "opp_desk_vacuum",
    }));
    const ctx = createFixtureContext(risk, result);
    const slice = await runListingAgent(ctx, { mode: "fixture", runId: "run_listing_primary_boundary" });

    expect(slice.selected_listing?.opportunity_id).toBe("opp_desk_vacuum");
    expect(slice.opportunities).toBeUndefined();
    expect(result.opportunities.find((opportunity) => opportunity.id === "opp_desk_vacuum")?.margin).not.toBeNull();
  });

  it("does not produce a ready handoff when every candidate is hard-filtered", async () => {
    const risk = createSpyRisk();
    const result = cloneRunResult(mockResult as RunResult);
    result.opportunities = result.opportunities.map((opportunity) => ({
      ...opportunity,
      decision: "Reject",
      decision_reason: "Regression fixture rejects every opportunity.",
      stock_status: "out",
      is_primary: opportunity.id === "opp_desk_vacuum",
    }));
    const ctx = createFixtureContext(risk, result);
    const slice = await runListingAgent(ctx, { mode: "fixture", runId: "run_listing_all_filtered" });

    expect(slice.selected_listing?.editable_json_ready).toBe(false);
    expect(slice.selected_listing?.compliance.warnings.join(" ")).toContain("All opportunities were hard-filtered");
    expect(risk.checkpoint).toHaveBeenCalledWith(
      "listing",
      expect.objectContaining({
        selection: expect.objectContaining({
          filters: expect.arrayContaining([
            expect.objectContaining({ opportunity_id: "opp_desk_vacuum", status: "filtered" }),
          ]),
        }),
      }),
    );
  });

  it("applies hard-block policy signals and validates selected_listing shape", async () => {
    const output = await replayFixture();
    const rejectedVector = output.feature_vectors.find((vector) => vector.opportunity_id === "opp_mini_dehumidifier");

    expect(rejectedVector?.compliance).toBe(0);
    expect(validateJsonSchema(selectedListingSchema, output.selected_listing).valid).toBe(true);
    expect(
      validateJsonSchema(selectedListingSchema, {
        ...output.selected_listing,
        shopee: {
          ...output.selected_listing.shopee,
          price: "11.9",
        },
      }).valid,
    ).toBe(false);
  });

  it("builds a Singapore-aware input table from local tools", async () => {
    const ctx = createFixtureContext(createSpyRisk());
    const input = await buildListingInput(ctx, { mode: "fixture" });

    expect(input.evidence.market_search?.market).toBe("Singapore");
    expect(input.evidence.sourcing_search?.offers.length).toBeGreaterThan(0);
    expect(input.evidence.shipping?.to).toBe("SG");
    expect(input.evidence.fx?.to).toBe("SGD");
    expect(input.evidence.policy_rules.map((rule) => rule.id)).toContain("sg-electrical-safety-review");
    expect(input.evidence.market_context.caveats.join(" ")).toContain("live social trend");
  });
});

function createFixtureContext(
  risk: RiskSupervisor,
  result: RunResult = mockResult as RunResult,
): Parameters<typeof buildListingInput>[0] {
  return {
    brief: result.brief,
    results: result,
    providers: {
      shopee: createSeedShopeeProvider(),
      sourcing1688: createSeedSourcing1688Provider(),
      shipping: createSeedShippingProvider(),
      fx: createSeedFxProvider(),
      openaiImage: createSeedOpenAIImageProvider(),
    },
    risk,
  };
}

function cloneRunResult(result: RunResult): RunResult {
  return JSON.parse(JSON.stringify(result)) as RunResult;
}

function createSpyRisk(): RiskSupervisor {
  const checkpoint: RiskSupervisor["checkpoint"] = vi.fn(async (stage): Promise<RiskCheckpoint> => ({
    stage,
    risk_level: "medium",
    human_review_required: true,
    hard_block: false,
    warnings: ["USB electrical review remains required before Packaging launch."],
    evidence: [{ label: "Risk checkpoint", value: "listing" }],
    flags: ["electrical_review"],
  }));

  return {
    checkpoint,
    getCheckpoints: () => [],
  };
}
