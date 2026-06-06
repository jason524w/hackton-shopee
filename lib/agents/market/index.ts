import type { AgentResult, Opportunity, RunResult } from "../../../contract/result";
import { assertAgentSuccess, runAgent, type AgentRunMode } from "../../agent-runtime/run-agent";
import type { AuditSink } from "../../agent-runtime/audit";
import type { ShopeeProductDetailResult, ShopeeProductSummary, ShopeeSearchProductsResult } from "../../providers";
import type { Agent, AgentContext } from "../contracts";
import { marketSkill } from "./skill";
import { createMarketTools } from "./tools";
import { marketOutputSchema, type MarketAgentInput, type MarketDirection, type MarketOutput } from "./schema";

export interface RunMarketAgentOptions {
  mode?: AgentRunMode;
  runId?: string;
  audit?: AuditSink;
  timeoutMs?: number;
}

export async function runMarketAgent(
  input: MarketAgentInput,
  ctx: AgentContext,
  options: RunMarketAgentOptions = {},
): Promise<MarketOutput> {
  const mode = options.mode ?? "fixture";
  const result = await runAgent<MarketAgentInput, MarketOutput>({
    agentKey: "market",
    skill: marketSkill,
    input,
    outputSchema: marketOutputSchema,
    outputSchemaName: "market_output",
    tools: createMarketTools(ctx.providers),
    mode,
    fixture: () => buildFixtureOutput(input, ctx),
    runId: options.runId,
    audit: options.audit,
    timeoutMs: options.timeoutMs,
    metadata: { task: "TASK-MARKET-SOURCING" },
  });

  return assertAgentSuccess(result);
}

export const marketAgent: Agent = async (ctx: AgentContext): Promise<Partial<RunResult>> => {
  const output = await runMarketAgent({ brief: ctx.brief }, ctx);
  return toMarketRunResultSlice(output);
};

export function toMarketRunResultSlice(output: MarketOutput): Partial<RunResult> {
  return {
    agents: [output.agent_result],
    opportunities: output.directions.map(directionToOpportunity),
  };
}

async function buildFixtureOutput(input: MarketAgentInput, ctx: AgentContext): Promise<MarketOutput> {
  const { brief } = input;
  const search = await ctx.providers.shopee.searchProducts({
    query: brief.product_intent,
    market: brief.target_market,
    category: brief.category,
    limit: 10,
  });
  const primaryProduct = search.products[0];
  const detail = primaryProduct
    ? await ctx.providers.shopee.getProductDetail({ itemId: primaryProduct.item_id })
    : undefined;
  const stats = summarizeMarket(search);
  const directions = buildDirections(brief, search, detail, stats);
  const warnings = [
    "Demand uses review/rating/listing-count proxies only; no real monthly sales claim is made.",
    "Compact desk vacuum listings show similar title structures, so packaging differentiation is needed.",
  ];
  const evidence = [
    { label: "Shopee competitors", value: `${search.competitor_count} seed-backed listings returned` },
    {
      label: "Price band",
      value: `SGD ${search.price_band.low.toFixed(2)}-${search.price_band.high.toFixed(2)}; median SGD ${search.price_band.median.toFixed(2)}`,
    },
    {
      label: "Review proxy",
      value: `Top seed listing has ${stats.review_density.top_review_count} reviews; average ${stats.review_density.average_review_count}`,
    },
    {
      label: "Source snapshot",
      value: `${search.source.provider}:${search.source.fixture_id ?? "live"} (${search.source.captured_at})`,
    },
  ];
  const agentResult: AgentResult = {
    key: "market",
    name: "Market Trend Agent",
    role: "Prediction / Market Intelligence",
    status: "done",
    inputs_summary: `${brief.target_market} · ${brief.target_platform} · ${brief.product_intent}`,
    data_sources: ["Shopee search provider", "Shopee product detail provider"],
    evidence,
    key_judgment:
      "Shopee SG seed data shows real proxy demand for compact USB desk vacuums through reviewed listings, coherent pricing, and strong ratings; treat this as a testable Watch/Go candidate pending sourcing and risk review.",
    audit_summary: "",
    score: stats.demand_score,
    confidence: 0.74,
    warnings,
  };

  return {
    agent_result: agentResult,
    directions,
    primary_direction_id: "opp_desk_vacuum",
    demand_score: stats.demand_score,
    competitor_count: search.competitor_count,
    price_band: search.price_band,
    review_density: stats.review_density,
    rating_distribution: stats.rating_distribution,
    tool_snapshots: [
      {
        tool_name: "shopee_search_products",
        provider: search.source.provider,
        mode: search.source.mode,
        fixture_id: search.source.fixture_id ?? "",
        source_url: search.source.source_url ?? "",
        captured_at: search.source.captured_at,
      },
      ...(detail
        ? [
            {
              tool_name: "shopee_get_product_detail",
              provider: detail.source.provider,
              mode: detail.source.mode,
              fixture_id: detail.source.fixture_id ?? "",
              source_url: detail.source.source_url ?? "",
              captured_at: detail.source.captured_at,
            },
          ]
        : []),
    ],
  };
}

function summarizeMarket(search: ShopeeSearchProductsResult): {
  demand_score: number;
  review_density: MarketOutput["review_density"];
  rating_distribution: MarketOutput["rating_distribution"];
} {
  const reviewCounts = search.products.map((product) => product.review_count);
  const ratings = search.products.map((product) => product.rating);
  const topReviewCount = Math.max(...reviewCounts, 0);
  const averageReviewCount = round(average(reviewCounts), 1);
  const averageRating = round(average(ratings), 2);
  const demandScore = clamp(
    Math.round(
      40 +
        Math.min(16, search.competitor_count * 4) +
        Math.min(14, topReviewCount / 16) +
        Math.min(20, averageRating * 4),
    ),
    0,
    100,
  );

  return {
    demand_score: demandScore,
    review_density: {
      top_review_count: topReviewCount,
      average_review_count: averageReviewCount,
      reviewed_listing_count: reviewCounts.filter((count) => count > 0).length,
    },
    rating_distribution: {
      min: round(Math.min(...ratings), 2),
      max: round(Math.max(...ratings), 2),
      average: averageRating,
    },
  };
}

function buildDirections(
  brief: MarketAgentInput["brief"],
  search: ShopeeSearchProductsResult,
  detail: ShopeeProductDetailResult | undefined,
  stats: ReturnType<typeof summarizeMarket>,
): MarketDirection[] {
  const primary = search.products[0];
  const cuteAngle = findByTitle(search.products, "Cute") ?? search.products[1] ?? primary;
  const studentAngle = findByTitle(search.products, "Student") ?? search.products[2] ?? primary;
  const shared = {
    target_market: brief.target_market,
    target_platform: brief.target_platform,
    competitor_count: search.competitor_count,
    price_band: search.price_band,
    review_density: stats.review_density,
    rating_distribution: stats.rating_distribution,
  };

  return [
    {
      ...shared,
      id: "opp_desk_vacuum",
      is_primary: true,
      name: "Mini Desk Vacuum (USB, cordless)",
      direction: "Compact USB desk and keyboard cleaning appliance",
      query: brief.product_intent,
      demand_signal_score: stats.demand_score,
      market_heat: heatFromScore(stats.demand_score),
      suggested_price: primary?.price_sgd ?? search.price_band.median,
      source_product_ids: search.products.map((product) => product.item_id),
      evidence: [
        { label: "Primary listing", value: primary?.evidence_label ?? "Shopee seed result" },
        { label: "Style notes", value: detail?.product.style_notes.join("; ") ?? "No detail style notes available" },
      ],
      confidence: 0.74,
      warnings: ["Avoid treating review-count proxy as a real sales number."],
    },
    {
      ...shared,
      id: "opp_cute_table_vacuum",
      is_primary: false,
      name: "Cute Mini Table Vacuum",
      direction: "Lifestyle-led desk vacuum packaging for home office and HDB study desks",
      query: "cute mini table vacuum",
      demand_signal_score: clamp(stats.demand_score - 6, 0, 100),
      market_heat: heatFromScore(stats.demand_score - 6),
      suggested_price: cuteAngle?.price_sgd ?? search.price_band.high,
      source_product_ids: cuteAngle ? [cuteAngle.item_id] : [],
      evidence: [{ label: "Angle source", value: cuteAngle?.evidence_label ?? "Derived from Shopee seed titles" }],
      confidence: 0.66,
      warnings: ["Secondary angle uses the same desk-vacuum seed set, not an independent category search."],
    },
    {
      ...shared,
      id: "opp_student_desk_cleaner",
      is_primary: false,
      name: "Student Desk Dust Cleaner",
      direction: "Budget mini vacuum angle for student desks, keyboards and dry crumbs",
      query: "student desk dust cleaner",
      demand_signal_score: clamp(stats.demand_score - 10, 0, 100),
      market_heat: heatFromScore(stats.demand_score - 10),
      suggested_price: studentAngle?.price_sgd ?? search.price_band.low,
      source_product_ids: studentAngle ? [studentAngle.item_id] : [],
      evidence: [{ label: "Angle source", value: studentAngle?.evidence_label ?? "Derived from Shopee seed titles" }],
      confidence: 0.62,
      warnings: ["Secondary angle should stay lightweight until separate market seed data exists."],
    },
  ];
}

function directionToOpportunity(direction: MarketDirection): Opportunity {
  return {
    id: direction.id,
    is_primary: direction.is_primary,
    name: direction.name,
    direction: direction.direction,
    target_market: direction.target_market,
    target_platform: direction.target_platform,
    source_price: 0,
    suggested_price: direction.suggested_price,
    minimum_viable_price: 0,
    gross_margin: 0,
    stock_status: "low",
    fulfillment_days: 0,
    market_heat: direction.market_heat,
    risk_level: "medium",
    decision: "Watch",
    decision_reason: "Preliminary market direction; requires sourcing, margin and risk review before launch.",
    scores: {
      profit: 0,
      demand: direction.demand_signal_score,
      compliance: 0,
      fulfillment: 0,
      packaging: 0,
      overall: direction.demand_signal_score,
    },
    margin: null,
    key_reasons: direction.evidence.map((item) => item.value),
  };
}

function findByTitle(products: ShopeeProductSummary[], term: string): ShopeeProductSummary | undefined {
  const normalizedTerm = term.toLowerCase();
  return products.find((product) => product.title.toLowerCase().includes(normalizedTerm));
}

function heatFromScore(score: number): "low" | "medium" | "high" {
  if (score >= 72) {
    return "high";
  }
  if (score >= 50) {
    return "medium";
  }
  return "low";
}

function average(values: number[]): number {
  if (!values.length) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
