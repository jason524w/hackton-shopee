import { describe, expect, it } from "vitest";
import { createNoopRisk, type AgentContext } from "../../contracts";
import {
  createSeedBrowserRetrievalProvider,
  createSeedFxProvider,
  createSeedOpenAIImageProvider,
  createSeedShippingProvider,
  createSeedShopeeProvider,
  createSeedSourcing1688Provider,
} from "../../../providers";
import { assertOutput, replayFixture } from "../harness";
import { createMarketTools } from "../tools";

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

describe("market harness", () => {
  it("replays the Shopee fixture into a structured market output", async () => {
    const output = await replayFixture(createContext());

    assertOutput(output);
    expect(output.directions).toHaveLength(3);
    expect(output.primary_direction_id).toBe("opp_desk_vacuum");
    expect(output.competitor_count).toBeGreaterThan(0);
    expect(output.price_band.low).toBeGreaterThan(0);
    expect(output.price_band.high).toBeGreaterThanOrEqual(output.price_band.low);
    expect(output.agent_result.key_judgment).not.toMatch(/monthly sales|units sold per month/i);
    expect(output.tool_snapshots.every((snapshot) => snapshot.fixture_id)).toBe(true);
  });

  it("exposes controlled browser retrieval tools for no-API market evidence", () => {
    const toolNames = createMarketTools(createContext().providers).map((tool) => tool.name);

    expect(toolNames).toContain("browser_retrieve_page_snapshot");
    expect(toolNames).toContain("browser_extract_shopee_search");
    expect(toolNames).toContain("browser_extract_shopee_ads_signals");
    expect(toolNames).toContain("browser_extract_web_trend");
  });
});
