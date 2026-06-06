import type { AgentResult, Opportunity, RunResult } from "../../../contract/result";
import { assertAgentSuccess, runAgent, type AgentRunMode } from "../../agent-runtime/run-agent";
import type { AuditSink } from "../../agent-runtime/audit";
import type {
  FxConvertResult,
  ShippingEstimateResult,
  SourcingOfferDetail,
  SourcingOfferDetailResult,
  SourcingSearchOffersResult,
} from "../../providers";
import type { Agent, AgentContext } from "../contracts";
import type { MarketDirection } from "../market/schema";
import { sourcingSkill } from "./skill";
import { createSourcingTools } from "./tools";
import {
  sourcingOutputSchema,
  type SourcingAgentInput,
  type SourcingOutput,
  type SourcingSupplierCandidate,
} from "./schema";

export interface RunSourcingAgentOptions {
  mode?: AgentRunMode;
  runId?: string;
  audit?: AuditSink;
  timeoutMs?: number;
}

export async function runSourcingAgent(
  input: SourcingAgentInput,
  ctx: AgentContext,
  options: RunSourcingAgentOptions = {},
): Promise<SourcingOutput> {
  const mode = options.mode ?? "fixture";
  const result = await runAgent<SourcingAgentInput, SourcingOutput>({
    agentKey: "sourcing",
    skill: sourcingSkill,
    input,
    outputSchema: sourcingOutputSchema,
    outputSchemaName: "sourcing_output",
    tools: createSourcingTools(ctx.providers),
    mode,
    fixture: () => buildFixtureOutput(input, ctx),
    runId: options.runId,
    audit: options.audit,
    timeoutMs: options.timeoutMs,
    metadata: { task: "TASK-MARKET-SOURCING" },
  });

  return assertAgentSuccess(result);
}

export const sourcingAgent: Agent = async (ctx: AgentContext): Promise<Partial<RunResult>> => {
  const primaryOpportunity = ctx.results.opportunities?.find((opportunity) => opportunity.is_primary);
  const primaryDirection = primaryOpportunityToDirection(primaryOpportunity, ctx);
  const output = await runSourcingAgent({ brief: ctx.brief, primary_direction: primaryDirection }, ctx);
  return toSourcingRunResultSlice(output, primaryOpportunity);
};

export function toSourcingRunResultSlice(
  output: SourcingOutput,
  currentPrimary?: Opportunity,
): Partial<RunResult> {
  return {
    agents: [output.agent_result],
    opportunities: currentPrimary ? [mergePrimaryOpportunity(currentPrimary, output)] : undefined,
  };
}

async function buildFixtureOutput(input: SourcingAgentInput, ctx: AgentContext): Promise<SourcingOutput> {
  const { brief, primary_direction: primaryDirection } = input;
  const search = await ctx.providers.sourcing1688.searchOffers({
    query: primaryDirection.query || brief.product_intent,
    limit: 5,
  });
  const offerDetails = await Promise.all(
    search.offers.map((offer) => ctx.providers.sourcing1688.getOfferDetail({ offerId: offer.offer_id })),
  );
  const selectedDetail = selectBestOffer(offerDetails.map((detail) => detail.offer));
  const fx = await ctx.providers.fx.convert({
    amount: selectedDetail.source_price_cny,
    from: selectedDetail.currency,
    to: "SGD",
  });
  const shipping = await ctx.providers.shipping.estimateCrossBorder({
    weight_g: selectedDetail.package_weight_g,
    dimensions_cm: selectedDetail.package_dimensions_cm,
    from: "CN",
    to: "SG",
  });
  const candidates = await Promise.all(
    offerDetails.map(async (detail) => {
      const candidateFx =
        detail.offer.offer_id === selectedDetail.offer_id
          ? fx
          : await ctx.providers.fx.convert({
              amount: detail.offer.source_price_cny,
              from: detail.offer.currency,
              to: "SGD",
            });
      return toCandidate(detail.offer, candidateFx);
    }),
  );
  const selectedSupplier = candidates.find((candidate) => candidate.offer_id === selectedDetail.offer_id);
  if (!selectedSupplier) {
    throw new Error(`Selected supplier candidate missing for offer ${selectedDetail.offer_id}`);
  }

  const fulfillmentDays = selectedDetail.domestic_dispatch_days + shipping.scenarios.base.days_max;
  const warnings = buildWarnings(brief.max_fulfillment_days, fulfillmentDays, selectedDetail, shipping);
  const evidence = buildEvidence(selectedSupplier, fx, shipping, fulfillmentDays);
  const score = scoreSourcing(selectedDetail, fulfillmentDays, brief.max_fulfillment_days, warnings.length);
  const agentResult: AgentResult = {
    key: "sourcing",
    name: "Sourcing Agent",
    role: "Customer Service / Supplier Operations",
    status: "done",
    inputs_summary: `${primaryDirection.name} · max ${brief.max_fulfillment_days} fulfillment days · budget SGD ${brief.budget}`,
    data_sources: ["1688 provider", "FX provider", "Shipping provider"],
    evidence,
    key_judgment:
      warnings.length > 0
        ? "A low-MOQ supplier is available with complete package specs, but fulfillment reaches the seller limit in the base case and should be treated carefully."
        : "A low-MOQ supplier is available with complete package specs and fulfillment inside the seller limit.",
    score,
    confidence: warnings.length > 0 ? 0.68 : 0.76,
    warnings,
  };

  return {
    agent_result: agentResult,
    primary_direction_id: primaryDirection.id,
    selected_offer_id: selectedDetail.offer_id,
    selected_supplier: selectedSupplier,
    supplier_candidates: candidates,
    source_price_sgd: fx.converted_amount,
    fulfillment_days: fulfillmentDays,
    package_weight_g: selectedDetail.package_weight_g,
    package_dimensions_cm: selectedDetail.package_dimensions_cm,
    shipping: {
      chargeable_weight_g: shipping.chargeable_weight_g,
      low: shipping.scenarios.low,
      base: shipping.scenarios.base,
      high: shipping.scenarios.high,
      assumptions: shipping.assumptions,
    },
    fx: {
      amount: fx.amount,
      from: fx.from,
      to: fx.to,
      rate: fx.rate,
      converted_amount: fx.converted_amount,
    },
    warnings,
    evidence,
    tool_snapshots: [
      snapshot("sourcing_search_offers", search),
      snapshot("sourcing_get_offer_detail", offerDetails.find((detail) => detail.offer.offer_id === selectedDetail.offer_id)),
      snapshot("fx_convert", fx),
      snapshot("shipping_estimate_cross_border", shipping),
    ],
  };
}

function selectBestOffer(offers: SourcingOfferDetail[]): SourcingOfferDetail {
  const completeOffers = offers.filter(
    (offer) =>
      offer.available_stock > 0 &&
      offer.moq > 0 &&
      offer.package_weight_g > 0 &&
      offer.package_dimensions_cm.length > 0 &&
      offer.package_dimensions_cm.width > 0 &&
      offer.package_dimensions_cm.height > 0,
  );
  const candidates = completeOffers.length ? completeOffers : offers;
  return [...candidates].sort((a, b) => {
    const moqDelta = a.moq - b.moq;
    if (moqDelta !== 0) {
      return moqDelta;
    }
    return a.source_price_cny - b.source_price_cny;
  })[0];
}

function toCandidate(offer: SourcingOfferDetail, fx: FxConvertResult): SourcingSupplierCandidate {
  return {
    offer_id: offer.offer_id,
    title: offer.title,
    supplier_name: offer.supplier_name,
    supplier_location: offer.supplier_location,
    source_price_cny: offer.source_price_cny,
    source_price_sgd: fx.converted_amount,
    moq: offer.moq,
    available_stock: offer.available_stock,
    domestic_dispatch_days: offer.domestic_dispatch_days,
    package_weight_g: offer.package_weight_g,
    package_dimensions_cm: offer.package_dimensions_cm,
    evidence_label: offer.evidence_label,
    source_url: offer.source_url ?? "",
    warnings: offer.supplier_risk_notes,
  };
}

function buildWarnings(
  maxFulfillmentDays: number,
  fulfillmentDays: number,
  offer: SourcingOfferDetail,
  shipping: ShippingEstimateResult,
): string[] {
  const highFulfillmentDays = offer.domestic_dispatch_days + shipping.scenarios.high.days_max;
  const warnings = [...offer.supplier_risk_notes];

  if (fulfillmentDays >= maxFulfillmentDays) {
    warnings.push(`Base fulfillment estimate reaches the seller limit (${fulfillmentDays}/${maxFulfillmentDays} days).`);
  }

  if (highFulfillmentDays > maxFulfillmentDays) {
    warnings.push(`High shipping scenario can exceed the seller limit (${highFulfillmentDays}/${maxFulfillmentDays} days).`);
  }

  return warnings;
}

function buildEvidence(
  supplier: SourcingSupplierCandidate,
  fx: FxConvertResult,
  shipping: ShippingEstimateResult,
  fulfillmentDays: number,
) {
  return [
    { label: "Selected supplier", value: `${supplier.supplier_name}; MOQ ${supplier.moq}; stock ${supplier.available_stock}` },
    { label: "Source price", value: `CNY ${supplier.source_price_cny.toFixed(2)} → SGD ${supplier.source_price_sgd.toFixed(2)}` },
    {
      label: "FX snapshot",
      value: `${fx.source.provider}:${fx.source.fixture_id ?? "live"} rate ${fx.rate} (${fx.source.captured_at})`,
    },
    {
      label: "Shipping snapshot",
      value: `${shipping.source.provider}:${shipping.source.fixture_id ?? "live"} base SGD ${shipping.scenarios.base.cost_sgd.toFixed(2)}; ${shipping.scenarios.base.days_min}-${shipping.scenarios.base.days_max} days`,
    },
    { label: "Fulfillment", value: `${fulfillmentDays} days including domestic dispatch` },
  ];
}

function scoreSourcing(
  offer: SourcingOfferDetail,
  fulfillmentDays: number,
  maxFulfillmentDays: number,
  warningCount: number,
): number {
  const stockScore = offer.available_stock >= 1000 ? 18 : 10;
  const moqScore = offer.moq <= 5 ? 18 : 10;
  const specsScore = offer.package_weight_g > 0 ? 18 : 8;
  const fulfillmentScore = fulfillmentDays <= maxFulfillmentDays ? 24 : 12;
  return clamp(24 + stockScore + moqScore + specsScore + fulfillmentScore - warningCount * 4, 0, 100);
}

function mergePrimaryOpportunity(current: Opportunity, output: SourcingOutput): Opportunity {
  const baseShipping = output.shipping.base.cost_sgd;
  const grossMargin =
    current.suggested_price > 0
      ? round((current.suggested_price - output.source_price_sgd - baseShipping) / current.suggested_price, 2)
      : current.gross_margin;

  return {
    ...current,
    source_price: output.source_price_sgd,
    minimum_viable_price: round(output.source_price_sgd + baseShipping, 2),
    gross_margin: grossMargin,
    stock_status: output.selected_supplier.available_stock > 100 ? "in_stock" : "low",
    fulfillment_days: output.fulfillment_days,
    scores: {
      ...current.scores,
      fulfillment: output.agent_result.score,
      overall: Math.round((current.scores.overall + output.agent_result.score) / 2),
    },
    decision_reason: `${current.decision_reason} Sourcing found a seed-backed supplier, but fulfillment warnings still need margin/risk review.`,
    key_reasons: [
      ...current.key_reasons,
      `Supplier ${output.selected_supplier.supplier_name} at SGD ${output.source_price_sgd.toFixed(2)}`,
      `Base fulfillment ${output.fulfillment_days} days`,
    ],
  };
}

function primaryOpportunityToDirection(primary: Opportunity | undefined, ctx: AgentContext): MarketDirection {
  return {
    id: primary?.id ?? "opp_desk_vacuum",
    is_primary: true,
    name: primary?.name ?? "Mini Desk Vacuum (USB, cordless)",
    direction: primary?.direction ?? "Compact USB desk and keyboard cleaning appliance",
    query: ctx.brief.product_intent,
    target_market: ctx.brief.target_market,
    target_platform: ctx.brief.target_platform,
    demand_signal_score: primary?.scores.demand ?? 0,
    competitor_count: 0,
    price_band: { low: 0, high: 0, median: primary?.suggested_price ?? 0 },
    review_density: { top_review_count: 0, average_review_count: 0, reviewed_listing_count: 0 },
    rating_distribution: { min: 0, max: 0, average: 0 },
    market_heat: primary?.market_heat ?? "medium",
    suggested_price: primary?.suggested_price ?? 0,
    source_product_ids: [],
    evidence: [],
    confidence: 0.5,
    warnings: [],
  };
}

function snapshot(
  toolName: string,
  result: SourcingSearchOffersResult | SourcingOfferDetailResult | FxConvertResult | ShippingEstimateResult | undefined,
) {
  return {
    tool_name: toolName,
    provider: result?.source.provider ?? "",
    mode: result?.source.mode ?? "seed",
    fixture_id: result?.source.fixture_id ?? "",
    source_url: result?.source.source_url ?? "",
    captured_at: result?.source.captured_at ?? "",
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

