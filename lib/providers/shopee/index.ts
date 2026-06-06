import { includesQuery, readSeedJson, roundMoney } from "../shared";
import type {
  ShopeeCategoryAttributesInput,
  ShopeeCategoryAttributesResult,
  ShopeePolicyRulesInput,
  ShopeePolicyRulesResult,
  ShopeeProductDetailInput,
  ShopeeProductDetailResult,
  ShopeeProvider,
  ShopeeSearchProductsInput,
  ShopeeSearchProductsResult,
  ShopeeProductDetail,
  ShopeeProductSummary,
} from "./types";

interface ShopeeSearchSeed {
  fixture_id: string;
  captured_at: string;
  source_url: string;
  market: string;
  category: string;
  products: ShopeeProductSummary[];
}

interface ShopeeDetailsSeed {
  fixture_id: string;
  captured_at: string;
  products: ShopeeProductDetail[];
}

interface ShopeeCategorySeed {
  fixture_id: string;
  captured_at: string;
  categories: Array<Omit<ShopeeCategoryAttributesResult, "source">>;
}

interface ShopeeRulesSeed {
  fixture_id: string;
  captured_at: string;
  source_url: string;
  market: string;
  rules: ShopeePolicyRulesResult["rules"];
}

export function createSeedShopeeProvider(): ShopeeProvider {
  return {
    async searchProducts(input: ShopeeSearchProductsInput): Promise<ShopeeSearchProductsResult> {
      const seed = await readSeedJson<ShopeeSearchSeed>("seed/shopee/mini-desk-vacuum-search.json");
      const queryMatches = seed.products.filter((product) => includesQuery(product.title, input.query));
      const products = queryMatches.length ? queryMatches : seed.products;
      const limitedProducts = products.slice(0, input.limit ?? products.length);
      const prices = limitedProducts.map((product) => product.price_sgd).sort((a, b) => a - b);
      const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;

      return {
        source: {
          provider: "shopee",
          mode: "seed",
          fixture_id: seed.fixture_id,
          source_url: seed.source_url,
          captured_at: seed.captured_at,
        },
        query: input.query,
        market: input.market,
        category: input.category ?? seed.category,
        products: limitedProducts,
        competitor_count: products.length,
        price_band: {
          low: prices[0] ?? 0,
          high: prices[prices.length - 1] ?? 0,
          median: roundMoney(median),
        },
      };
    },

    async getProductDetail(input: ShopeeProductDetailInput): Promise<ShopeeProductDetailResult> {
      const seed = await readSeedJson<ShopeeDetailsSeed>("seed/shopee/mini-desk-vacuum-details.json");
      const product = seed.products.find((candidate) => candidate.item_id === input.itemId);
      if (!product) {
        throw new Error(`Shopee product detail not found for itemId=${input.itemId}`);
      }

      return {
        source: {
          provider: "shopee",
          mode: "seed",
          fixture_id: seed.fixture_id,
          source_url: product.product_url,
          captured_at: seed.captured_at,
        },
        product,
      };
    },

    async getCategoryAttributes(input: ShopeeCategoryAttributesInput): Promise<ShopeeCategoryAttributesResult> {
      const seed = await readSeedJson<ShopeeCategorySeed>("seed/shopee/category-attributes.json");
      const category = seed.categories.find((candidate) => candidate.category_id === input.categoryId);
      if (!category) {
        throw new Error(`Shopee category attributes not found for categoryId=${input.categoryId}`);
      }

      return {
        ...category,
        source: {
          provider: "shopee",
          mode: "seed",
          fixture_id: seed.fixture_id,
          captured_at: seed.captured_at,
        },
      };
    },

    async getPolicyRules(input: ShopeePolicyRulesInput): Promise<ShopeePolicyRulesResult> {
      const seed = await readSeedJson<ShopeeRulesSeed>("seed/shopee/policy-rules-sg.json");
      return {
        source: {
          provider: "shopee",
          mode: "seed",
          fixture_id: seed.fixture_id,
          source_url: seed.source_url,
          captured_at: seed.captured_at,
        },
        market: input.market,
        rules: seed.rules,
      };
    },
  };
}

export const shopeeProvider = createSeedShopeeProvider();
export type * from "./types";
