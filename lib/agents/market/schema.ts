import type { AgentResult, Brief, Evidence } from "../../../contract/result";
import type { JsonSchema } from "../../agent-runtime/schemas";
import { makeObjectSchema } from "../../agent-runtime/schemas";

export interface MarketAgentInput {
  brief: Brief;
}

export interface MarketPriceBand {
  low: number;
  high: number;
  median: number;
}

export interface ReviewDensity {
  top_review_count: number;
  average_review_count: number;
  reviewed_listing_count: number;
}

export interface RatingDistribution {
  min: number;
  max: number;
  average: number;
}

export interface MarketDirection {
  id: string;
  is_primary: boolean;
  name: string;
  direction: string;
  query: string;
  target_market: string;
  target_platform: string;
  demand_signal_score: number;
  competitor_count: number;
  price_band: MarketPriceBand;
  review_density: ReviewDensity;
  rating_distribution: RatingDistribution;
  market_heat: "low" | "medium" | "high";
  suggested_price: number;
  source_product_ids: string[];
  evidence: Evidence[];
  confidence: number;
  warnings: string[];
}

export interface ToolSnapshot {
  tool_name: string;
  provider: string;
  mode: "live" | "seed" | "snapshot" | "browser";
  fixture_id: string;
  source_url: string;
  captured_at: string;
}

export interface MarketOutput {
  agent_result: AgentResult;
  directions: MarketDirection[];
  primary_direction_id: string;
  demand_score: number;
  competitor_count: number;
  price_band: MarketPriceBand;
  review_density: ReviewDensity;
  rating_distribution: RatingDistribution;
  tool_snapshots: ToolSnapshot[];
}

const evidenceSchema = makeObjectSchema({
  label: { type: "string" },
  value: { type: "string" },
});

const priceBandSchema = makeObjectSchema({
  low: { type: "number", minimum: 0 },
  high: { type: "number", minimum: 0 },
  median: { type: "number", minimum: 0 },
});

const reviewDensitySchema = makeObjectSchema({
  top_review_count: { type: "number", minimum: 0 },
  average_review_count: { type: "number", minimum: 0 },
  reviewed_listing_count: { type: "number", minimum: 0 },
});

const ratingDistributionSchema = makeObjectSchema({
  min: { type: "number", minimum: 0 },
  max: { type: "number", minimum: 0 },
  average: { type: "number", minimum: 0 },
});

const agentResultSchema = makeObjectSchema({
  key: { const: "market" },
  name: { type: "string" },
  role: { type: "string" },
  status: { enum: ["waiting", "running", "done", "blocked"] },
  inputs_summary: { type: "string" },
  data_sources: { type: "array", items: { type: "string" } },
  evidence: { type: "array", items: evidenceSchema },
  key_judgment: { type: "string" },
  score: { type: "number", minimum: 0, maximum: 100 },
  confidence: { type: "number", minimum: 0, maximum: 1 },
  warnings: { type: "array", items: { type: "string" } },
});

const directionSchema = makeObjectSchema({
  id: { type: "string" },
  is_primary: { type: "boolean" },
  name: { type: "string" },
  direction: { type: "string" },
  query: { type: "string" },
  target_market: { type: "string" },
  target_platform: { type: "string" },
  demand_signal_score: { type: "number", minimum: 0, maximum: 100 },
  competitor_count: { type: "number", minimum: 0 },
  price_band: priceBandSchema,
  review_density: reviewDensitySchema,
  rating_distribution: ratingDistributionSchema,
  market_heat: { enum: ["low", "medium", "high"] },
  suggested_price: { type: "number", minimum: 0 },
  source_product_ids: { type: "array", items: { type: "string" } },
  evidence: { type: "array", items: evidenceSchema },
  confidence: { type: "number", minimum: 0, maximum: 1 },
  warnings: { type: "array", items: { type: "string" } },
});

const toolSnapshotSchema = makeObjectSchema({
  tool_name: { type: "string" },
  provider: { type: "string" },
  mode: { enum: ["live", "seed", "snapshot", "browser"] },
  fixture_id: { type: "string" },
  source_url: { type: "string" },
  captured_at: { type: "string" },
});

export const marketInputSchema: JsonSchema = makeObjectSchema({
  brief: { type: "object", additionalProperties: true },
});

export const marketOutputSchema: JsonSchema = makeObjectSchema({
  agent_result: agentResultSchema,
  directions: { type: "array", items: directionSchema, minItems: 3, maxItems: 3 },
  primary_direction_id: { type: "string" },
  demand_score: { type: "number", minimum: 0, maximum: 100 },
  competitor_count: { type: "number", minimum: 0 },
  price_band: priceBandSchema,
  review_density: reviewDensitySchema,
  rating_distribution: ratingDistributionSchema,
  tool_snapshots: { type: "array", items: toolSnapshotSchema },
});
