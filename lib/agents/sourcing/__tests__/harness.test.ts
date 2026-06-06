import { describe, expect, it } from "vitest";
import { createNoopRisk, runPipeline, type AgentContext } from "../../contracts";
import {
  createSeedBrowserRetrievalProvider,
  createSeedFxProvider,
  createSeedOpenAIImageProvider,
  createSeedShippingProvider,
  createSeedShopeeProvider,
  createSeedSourcing1688Provider,
} from "../../../providers";
import { marketAgent } from "../../market";
import { assertOutput, replayFixture } from "../harness";
import { sourcingAgent } from "../index";
import { createSourcingTools } from "../tools";

const brief = {
  target_market: "Singapore",
  target_platform: "Shopee" as const,
  seller_type: "individual_dropshipper",
  product_intent: "mini desk vacuum",
  category: "home_appliances_small",
  budget: 500,
  target_margin: 0.25,
  max_fulfillment_days: 12,
  risk_appetite: "balanced" as const,
  language: "en",
};

function createContext(): AgentContext {
  return {
    brief,
    results: {},
    providers: {
      shopee: createSeedShopeeProvider(),
      sourcing1688: createSeedSourcing1688Provider(),
      shipping: createSeedShippingProvider(),
      fx: createSeedFxProvider(),
      openaiImage: createSeedOpenAIImageProvider(),
      browser: createSeedBrowserRetrievalProvider(),
    },
    risk: createNoopRisk(),
  };
}

describe("sourcing harness", () => {
  it("replays 1688, FX and shipping fixtures into a structured sourcing output", async () => {
    const output = await replayFixture(createContext());

    assertOutput(output, brief.max_fulfillment_days);
    expect(output.source_price_sgd).toBeGreaterThan(0);
    expect(output.selected_supplier.moq).toBeGreaterThan(0);
    expect(output.selected_supplier.available_stock).toBeGreaterThan(0);
    expect(output.package_weight_g).toBeGreaterThan(0);
    expect(output.package_dimensions_cm.length).toBeGreaterThan(0);
    expect(output.fulfillment_days).toBeGreaterThan(0);
    expect(output.warnings.length).toBeGreaterThan(0);
    expect(output.evidence.some((item) => item.label === "FX snapshot")).toBe(true);
    expect(output.evidence.some((item) => item.label === "Shipping snapshot")).toBe(true);
  });

  it("folds market and sourcing agent slices through the shared pipeline seam", async () => {
    const result = await runPipeline([marketAgent, sourcingAgent], createContext());
    const primary = result.results.opportunities?.find((opportunity) => opportunity.id === "opp_desk_vacuum");

    expect(result.results.agents?.map((agent) => agent.key)).toEqual(["market", "sourcing"]);
    expect(primary?.source_price).toBeGreaterThan(0);
    expect(primary?.fulfillment_days).toBe(12);
  });

  it("exposes controlled browser retrieval tools for no-API sourcing evidence", () => {
    const toolNames = createSourcingTools(createContext().providers).map((tool) => tool.name);

    expect(toolNames).toContain("browser_retrieve_page_snapshot");
    expect(toolNames).toContain("browser_extract_1688_search");
    expect(toolNames).toContain("browser_extract_1688_offer");
    expect(toolNames).toContain("browser_refresh_offer_stock");
    expect(toolNames).toContain("browser_extract_supplier_signals");
  });
});
