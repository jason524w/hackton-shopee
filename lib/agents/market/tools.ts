import type { AgentTool } from "../../agent-runtime/tool-runner";
import { makeObjectSchema } from "../../agent-runtime/schemas";
import type { AgentProviders } from "../contracts";
import type {
  BrowserShopeeAdsSignalsInput,
  BrowserShopeeSearchInput,
  BrowserWebTrendInput,
  BrowserRetrievePageSnapshotInput,
  ShopeeProductDetailInput,
  ShopeeSearchProductsInput,
} from "../../providers";

export function createMarketTools(providers: AgentProviders): AgentTool[] {
  return [
    {
      name: "shopee_search_products",
      description: "Search seed-backed or live Shopee product results for the target market and category.",
      parameters: makeObjectSchema({
        query: { type: "string" },
        market: { type: "string" },
        category: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 20 },
      }),
      execute(input: unknown) {
        return providers.shopee.searchProducts(input as ShopeeSearchProductsInput);
      },
    },
    {
      name: "shopee_get_product_detail",
      description: "Fetch detail for a specific Shopee product returned by search.",
      parameters: makeObjectSchema({
        itemId: { type: "string" },
      }),
      async execute(input: unknown) {
        try {
          return await providers.shopee.getProductDetail(input as ShopeeProductDetailInput);
        } catch (error) {
          // Seed detail coverage is partial — let the model recover instead of killing the run.
          return {
            found: false,
            message: error instanceof Error ? error.message : "Product detail not found",
            hint: "Detail data is only captured for some items. Use the search result fields you already have, or query another itemId.",
          };
        }
      },
    },
    {
      name: "browser_retrieve_page_snapshot",
      description:
        "Capture a controlled browser page snapshot for an allowed market research URL. Returns redacted text excerpt, links, source metadata, and audit snapshot ids.",
      parameters: makeObjectSchema({
        url: { type: "string" },
        purpose: {
          type: "string", enum: ["market_shopee_search", "market_shopee_product", "market_shopee_ads", "market_web_trend"],
        },
      }),
      execute(input: unknown) {
        return providers.browser.retrievePageSnapshot(input as BrowserRetrievePageSnapshotInput);
      },
    },
    {
      name: "browser_extract_shopee_search",
      description:
        "Use the controlled browser retrieval provider to extract Shopee search page signals when direct API access is unavailable.",
      parameters: makeObjectSchema({
        query: { type: "string" },
        market: { type: "string" },
        category: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 20 },
      }),
      execute(input: unknown) {
        return providers.browser.extractShopeeSearch(input as BrowserShopeeSearchInput);
      },
    },
    {
      name: "browser_extract_shopee_ads_signals",
      description:
        "Use the controlled browser retrieval provider to capture Shopee Seller Centre / Ads recommendation signals when the user has access.",
      parameters: makeObjectSchema({
        market: { type: "string" },
        query: { type: "string" },
      }),
      execute(input: unknown) {
        return providers.browser.extractShopeeAdsSignals(input as BrowserShopeeAdsSignalsInput);
      },
    },
    {
      name: "browser_extract_web_trend",
      description:
        "Use the controlled browser retrieval provider to capture web trend evidence for the product direction.",
      parameters: makeObjectSchema({
        query: { type: "string" },
        market: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 10 },
      }),
      execute(input: unknown) {
        return providers.browser.extractWebTrend(input as BrowserWebTrendInput);
      },
    },
  ];
}
