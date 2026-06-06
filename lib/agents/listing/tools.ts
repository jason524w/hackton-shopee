import type { AgentTool } from "../../agent-runtime/tool-runner";
import type { AgentProviders } from "../contracts";
import type { MarketContextResult } from "./schema";

const DEFAULT_CATEGORY_ID = 100636;

export function createListingTools(providers: AgentProviders): AgentTool[] {
  return [
    {
      name: "search_shopee_market",
      description: "Fetch Shopee Singapore competitor listings, price band, review density, and demand evidence.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          market: { type: "string" },
          category: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["query", "market", "category", "limit"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { query: string; market: string; category: string; limit: number };
        return providers.shopee.searchProducts(value);
      },
    },
    {
      name: "search_1688_offers",
      description: "Fetch 1688 sourcing offers, source prices, MOQ, stock, and supplier evidence.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          limit: { type: "integer", minimum: 1, maximum: 10 },
        },
        required: ["query", "limit"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { query: string; limit: number };
        return providers.sourcing1688.searchOffers(value);
      },
    },
    {
      name: "get_1688_offer_detail",
      description: "Fetch package dimensions, SKU options, and supplier risk notes for a sourcing offer.",
      parameters: {
        type: "object",
        properties: {
          offerId: { type: "string" },
        },
        required: ["offerId"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { offerId: string };
        return providers.sourcing1688.getOfferDetail(value);
      },
    },
    {
      name: "estimate_cross_border_shipping",
      description: "Estimate cross-border shipping cost and delivery timing for China to Singapore.",
      parameters: {
        type: "object",
        properties: {
          weight_g: { type: "integer", minimum: 1 },
          length_cm: { type: "integer", minimum: 1 },
          width_cm: { type: "integer", minimum: 1 },
          height_cm: { type: "integer", minimum: 1 },
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["weight_g", "length_cm", "width_cm", "height_cm", "from", "to"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as {
          weight_g: number;
          length_cm: number;
          width_cm: number;
          height_cm: number;
          from: string;
          to: string;
        };
        return providers.shipping.estimateCrossBorder({
          weight_g: value.weight_g,
          dimensions_cm: {
            length: value.length_cm,
            width: value.width_cm,
            height: value.height_cm,
          },
          from: value.from,
          to: value.to,
        });
      },
    },
    {
      name: "convert_fx",
      description: "Convert source prices between currencies for margin and price-sensitivity checks.",
      parameters: {
        type: "object",
        properties: {
          amount: { type: "number", minimum: 0 },
          from: { type: "string" },
          to: { type: "string" },
        },
        required: ["amount", "from", "to"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { amount: number; from: string; to: string };
        return providers.fx.convert(value);
      },
    },
    {
      name: "get_shopee_policy_rules",
      description: "Fetch Shopee Singapore policy and listing-risk rules relevant to ranking and packaging handoff.",
      parameters: {
        type: "object",
        properties: {
          market: { type: "string" },
        },
        required: ["market"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { market: string };
        return providers.shopee.getPolicyRules(value);
      },
    },
    {
      name: "get_category_attributes",
      description: "Fetch Shopee category attributes needed by the downstream Packaging Agent handoff.",
      parameters: {
        type: "object",
        properties: {
          categoryId: { type: "integer", minimum: 1 },
        },
        required: ["categoryId"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { categoryId: number };
        return providers.shopee.getCategoryAttributes({ categoryId: value.categoryId || DEFAULT_CATEGORY_ID });
      },
    },
    {
      name: "get_singapore_market_context",
      description: "Return local Singapore use-case and freshness caveats. This is deterministic until a live trends connector is added.",
      parameters: {
        type: "object",
        properties: {
          market: { type: "string" },
          category: { type: "string" },
          product_intent: { type: "string" },
        },
        required: ["market", "category", "product_intent"],
        additionalProperties: false,
      },
      execute: (input) => {
        const value = input as { market: string; category: string; product_intent: string };
        return buildSingaporeMarketContext(value.market, value.category, value.product_intent);
      },
    },
  ];
}

export function buildSingaporeMarketContext(
  market: string,
  category: string,
  productIntent: string,
  capturedAt = "2026-06-06T00:00:00+08:00",
): MarketContextResult {
  const normalized = `${market} ${category} ${productIntent}`.toLowerCase();
  const compactLiving = normalized.includes("desk") || normalized.includes("home") || normalized.includes("office");
  const electrical = normalized.includes("vacuum") || normalized.includes("usb") || normalized.includes("appliance");

  return {
    market,
    captured_at: capturedAt,
    freshness: "seed",
    recent_signals: [
      {
        label: "Local space constraint",
        value: compactLiving
          ? "Compact HDB, dorm, and office-desk use cases are relevant for Singapore positioning."
          : "No product-specific local space signal found in seed context.",
        confidence: compactLiving ? 0.74 : 0.45,
      },
      {
        label: "Freshness caveat",
        value: "Live trend, holiday, platform-campaign, and news checks require a future connector before increasing rank weight.",
        confidence: 0.9,
      },
      {
        label: "Electrical review",
        value: electrical
          ? "USB or appliance-like products should carry human review until supplier safety details are verified."
          : "No electrical-specific seed signal detected.",
        confidence: electrical ? 0.82 : 0.5,
      },
    ],
    local_use_cases: compactLiving
      ? ["HDB home office", "student desk", "small office desk", "keyboard and dry crumb cleanup"]
      : ["price-sensitive Shopee SG browsing", "small parcel cross-border trial"],
    caveats: [
      "No live social trend or breaking-news connector is available in this MVP path.",
      "Do not upgrade ranking solely from model priors about Singapore buyers.",
    ],
  };
}
