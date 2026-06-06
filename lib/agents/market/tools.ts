import type { AgentTool } from "../../agent-runtime/tool-runner";
import { makeObjectSchema } from "../../agent-runtime/schemas";
import type { AgentProviders } from "../contracts";
import type { ShopeeProductDetailInput, ShopeeSearchProductsInput } from "../../providers";

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
      execute(input: unknown) {
        return providers.shopee.getProductDetail(input as ShopeeProductDetailInput);
      },
    },
  ];
}

