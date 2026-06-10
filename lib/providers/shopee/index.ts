import { includesQuery, readSeedJson, roundMoney } from "../shared";
import type { ProviderWarning } from "../shared";
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
      // Do NOT fabricate matches: when the query does not match the captured seed rows,
      // return an empty result + explicit warning instead of passing off desk-vacuum data.
      const queryMatches = seed.products.filter((product) => includesQuery(product.title, input.query));
      const limitedProducts = queryMatches.slice(0, input.limit ?? queryMatches.length);
      const prices = limitedProducts.map((product) => product.price_sgd).sort((a, b) => a - b);
      const median = prices.length ? prices[Math.floor(prices.length / 2)] : 0;
      const warnings: ProviderWarning[] = queryMatches.length
        ? []
        : [
            {
              code: "SEED_QUERY_MISMATCH",
              severity: "warning",
              message: `Seed Shopee data does not cover "${input.query}"; returning no products rather than fabricating unrelated rows. Enable a live Shopee provider for arbitrary queries.`,
            },
          ];

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
        competitor_count: limitedProducts.length,
        price_band: {
          low: prices[0] ?? 0,
          high: prices[prices.length - 1] ?? 0,
          median: roundMoney(median),
        },
        warnings: warnings.length ? warnings : undefined,
      };
    },

    async getProductDetail(input: ShopeeProductDetailInput): Promise<ShopeeProductDetailResult> {
      const seed = await readSeedJson<ShopeeDetailsSeed>("seed/shopee/mini-desk-vacuum-details.json");
      const product =
        seed.products.find((candidate) => candidate.item_id === input.itemId) ??
        (await buildSummaryBackedDetail(input.itemId));

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

// Detail seed coverage is partial (captured for the hero item only). For other
// itemIds returned by search, synthesize a degraded-but-structured detail from
// the REAL captured search row instead of failing the tool call (GAP-6). The
// synthetic fields are clearly labeled so agents don't over-trust them.
async function buildSummaryBackedDetail(itemId: string): Promise<ShopeeProductDetail> {
  const searchSeed = await readSeedJson<ShopeeSearchSeed>("seed/shopee/mini-desk-vacuum-search.json");
  const summary = searchSeed.products.find((candidate) => candidate.item_id === itemId);
  if (!summary) {
    throw new Error(`Shopee product detail not found for itemId=${itemId}`);
  }

  return {
    ...summary,
    description:
      "(detail not captured — derived from search listing) " +
      `${summary.title}. Rated ${summary.rating}★ across ${summary.review_count} reviews` +
      (summary.sold_label ? `, ${summary.sold_label}.` : "."),
    bullet_points: [],
    attributes: {},
    logistics: { weight_g: 0, length_cm: 0, width_cm: 0, height_cm: 0 },
    seller_location: "",
    style_notes: ["search-derived detail; logistics/attributes unavailable"],
    evidence_label: `${summary.evidence_label} (search-derived detail)`,
  };
}

export const shopeeProvider = createSeedShopeeProvider();
export type * from "./types";
