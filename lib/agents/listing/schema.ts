import type { AgentResult, Brief, Evidence, Opportunity, SelectedListing } from "../../../contract/result";
import type { JsonSchema } from "../../agent-runtime/schemas";
import type { FxConvertResult } from "../../providers/fx/types";
import type { ShippingEstimateResult } from "../../providers/shipping/types";
import type {
  ShopeeCategoryAttributesResult,
  ShopeePolicyRule,
  ShopeeSearchProductsResult,
} from "../../providers/shopee/types";
import type { SourcingOfferDetailResult, SourcingSearchOffersResult } from "../../providers/sourcing-1688/types";

export type ListingRunMode = "fixture" | "live";
export type ListingFilterStatus = "selected" | "candidate" | "filtered";
export type PriceVolatilityRisk = "low" | "medium" | "high";

export interface MarketContextSignal {
  label: string;
  value: string;
  confidence: number;
}

export interface MarketContextResult {
  market: string;
  captured_at: string;
  freshness: "seed" | "live" | "operator_required";
  recent_signals: MarketContextSignal[];
  local_use_cases: string[];
  caveats: string[];
}

export interface ListingToolEvidence {
  market_search?: ShopeeSearchProductsResult;
  sourcing_search?: SourcingSearchOffersResult;
  offer_detail?: SourcingOfferDetailResult;
  shipping?: ShippingEstimateResult;
  fx?: FxConvertResult;
  policy_rules: ShopeePolicyRule[];
  category_attributes?: ShopeeCategoryAttributesResult;
  market_context: MarketContextResult;
}

export interface ListingInput {
  run_id: string;
  mode: ListingRunMode;
  brief: Brief;
  opportunities: Opportunity[];
  preferred_opportunity_id?: string;
  evidence: ListingToolEvidence;
  risk_warnings: string[];
}

export interface OpportunityFactorScores {
  opportunity_id: string;
  demand: number;
  profit: number;
  sourcing: number;
  compliance: number;
  fulfillment: number;
  market_timing: number;
  price_stability: number;
  overall: number;
}

export interface OpportunityFeatureVector extends OpportunityFactorScores {
  status: ListingFilterStatus;
  price_volatility_risk: PriceVolatilityRisk;
  reasons: string[];
  evidence: Evidence[];
}

export interface ListingSelection {
  ranked_ids: string[];
  selected_opportunity_id: string;
  factor_scores: OpportunityFactorScores[];
  filters: Array<{
    opportunity_id: string;
    status: ListingFilterStatus;
    reasons: string[];
  }>;
  tradeoffs: Array<{
    opportunity_id: string;
    conflict: string;
    resolution: string;
  }>;
  handoff_notes: string[];
}

export interface ListingOutput {
  feature_vectors: OpportunityFeatureVector[];
  selection: ListingSelection;
  selected_listing: SelectedListing;
  agent: AgentResult;
}

const listingImageSchema: JsonSchema = {
  type: "object",
  properties: {
    type: { enum: ["hero", "lifestyle", "feature"] },
    url: { type: "string" },
    prompt: { type: "string" },
    compliance: { enum: ["ok", "needs_review", "rejected"] },
  },
  required: ["type", "url", "prompt", "compliance"],
  additionalProperties: false,
};

export const shopeeListingSchema: JsonSchema = {
  type: "object",
  properties: {
    item_name: { type: "string" },
    category: { type: "string" },
    category_id: { type: "integer" },
    brand: { type: "string" },
    condition: { type: "string" },
    price: { type: "number" },
    stock: { type: "integer" },
    sku: { type: "string" },
    variations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          options: { type: "array", items: { type: "string" } },
        },
        required: ["name", "options"],
        additionalProperties: false,
      },
    },
    attributes: { type: "object", additionalProperties: { type: "string" } },
    description: { type: "string" },
    bullet_points: { type: "array", items: { type: "string" } },
    logistics: {
      type: "object",
      properties: {
        weight_g: { type: "integer" },
        length_cm: { type: "integer" },
        width_cm: { type: "integer" },
        height_cm: { type: "integer" },
      },
      required: ["weight_g", "length_cm", "width_cm", "height_cm"],
      additionalProperties: false,
    },
    required_fields_total: { type: "integer" },
    required_fields_filled: { type: "integer" },
    missing_fields: { type: "array", items: { type: "string" } },
  },
  required: [
    "item_name",
    "category",
    "category_id",
    "brand",
    "condition",
    "price",
    "stock",
    "sku",
    "variations",
    "attributes",
    "description",
    "bullet_points",
    "logistics",
    "required_fields_total",
    "required_fields_filled",
    "missing_fields",
  ],
  additionalProperties: false,
};

export const selectedListingSchema: JsonSchema = {
  type: "object",
  properties: {
    opportunity_id: { type: "string" },
    platform: { enum: ["Shopee", "Lazada"] },
    market: { type: "string" },
    language: { type: "string" },
    shopee: shopeeListingSchema,
    images: { type: "array", items: listingImageSchema },
    compliance: {
      type: "object",
      properties: {
        human_review_required: { type: "boolean" },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: ["human_review_required", "warnings"],
      additionalProperties: false,
    },
    editable_json_ready: { type: "boolean" },
  },
  required: [
    "opportunity_id",
    "platform",
    "market",
    "language",
    "shopee",
    "images",
    "compliance",
    "editable_json_ready",
  ],
  additionalProperties: false,
};

const factorScoreSchema: JsonSchema = {
  type: "object",
  properties: {
    opportunity_id: { type: "string" },
    demand: { type: "number", minimum: 0, maximum: 100 },
    profit: { type: "number", minimum: 0, maximum: 100 },
    sourcing: { type: "number", minimum: 0, maximum: 100 },
    compliance: { type: "number", minimum: 0, maximum: 100 },
    fulfillment: { type: "number", minimum: 0, maximum: 100 },
    market_timing: { type: "number", minimum: 0, maximum: 100 },
    price_stability: { type: "number", minimum: 0, maximum: 100 },
    overall: { type: "number", minimum: 0, maximum: 100 },
  },
  required: [
    "opportunity_id",
    "demand",
    "profit",
    "sourcing",
    "compliance",
    "fulfillment",
    "market_timing",
    "price_stability",
    "overall",
  ],
  additionalProperties: false,
};

export const listingSelectionSchema: JsonSchema = {
  type: "object",
  properties: {
    ranked_ids: { type: "array", items: { type: "string" }, minItems: 1 },
    selected_opportunity_id: { type: "string" },
    factor_scores: { type: "array", items: factorScoreSchema, minItems: 1 },
    filters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          opportunity_id: { type: "string" },
          status: { enum: ["selected", "candidate", "filtered"] },
          reasons: { type: "array", items: { type: "string" } },
        },
        required: ["opportunity_id", "status", "reasons"],
        additionalProperties: false,
      },
    },
    tradeoffs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          opportunity_id: { type: "string" },
          conflict: { type: "string" },
          resolution: { type: "string" },
        },
        required: ["opportunity_id", "conflict", "resolution"],
        additionalProperties: false,
      },
    },
    handoff_notes: { type: "array", items: { type: "string" } },
  },
  required: ["ranked_ids", "selected_opportunity_id", "factor_scores", "filters", "tradeoffs", "handoff_notes"],
  additionalProperties: false,
};

export const listingOutputSchema: JsonSchema = {
  type: "object",
  properties: {
    feature_vectors: {
      type: "array",
      items: {
        type: "object",
        properties: {
          ...factorScoreSchema.properties,
          status: { enum: ["selected", "candidate", "filtered"] },
          price_volatility_risk: { enum: ["low", "medium", "high"] },
          reasons: { type: "array", items: { type: "string" } },
          evidence: {
            type: "array",
            items: {
              type: "object",
              properties: {
                label: { type: "string" },
                value: { type: "string" },
              },
              required: ["label", "value"],
              additionalProperties: false,
            },
          },
        },
        required: [
          "opportunity_id",
          "demand",
          "profit",
          "sourcing",
          "compliance",
          "fulfillment",
          "market_timing",
          "price_stability",
          "overall",
          "status",
          "price_volatility_risk",
          "reasons",
          "evidence",
        ],
        additionalProperties: false,
      },
      minItems: 1,
    },
    selection: listingSelectionSchema,
    selected_listing: selectedListingSchema,
    agent: { type: "object", additionalProperties: true },
  },
  required: ["feature_vectors", "selection", "selected_listing", "agent"],
  additionalProperties: false,
};
