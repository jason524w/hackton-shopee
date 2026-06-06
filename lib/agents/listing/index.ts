import type {
  AgentResult,
  Evidence,
  ListingImage,
  Opportunity,
  RunResult,
  SelectedListing,
  ShopeeListing,
} from "../../../contract/result";
import { assertAgentSuccess, runAgent } from "../../agent-runtime/run-agent";
import { validateJsonSchema } from "../../agent-runtime/schemas";
import type { AuditSink } from "../../agent-runtime/audit";
import type { AgentContext, RiskCheckpoint } from "../contracts";
import { listingSkill } from "./skill";
import { buildSingaporeMarketContext, createListingTools } from "./tools";
import {
  listingOutputSchema,
  listingSelectionSchema,
  type ListingFilterStatus,
  type ListingInput,
  type ListingOutput,
  type ListingRunMode,
  type ListingSelection,
  type ListingToolEvidence,
  type MarketContextResult,
  type OpportunityFactorScores,
  type OpportunityFeatureVector,
  type PriceVolatilityRisk,
} from "./schema";

export interface RunListingAgentOptions {
  runId?: string;
  mode?: ListingRunMode;
  preferredOpportunityId?: string;
  categoryId?: number;
  model?: string;
  apiKey?: string;
  audit?: AuditSink;
}

const DEFAULT_CATEGORY_ID = 100636;
const BANNED_CLAIMS = ["super suction", "industrial grade", "certified safety", "guaranteed deep cleaning"];
const BASE_REQUIRED_FIELDS = [
  "item_name",
  "category",
  "category_id",
  "brand",
  "condition",
  "price",
  "stock",
  "sku",
  "description",
  "bullet_points",
  "logistics",
];

export async function runListingAgent(
  ctx: AgentContext,
  options: RunListingAgentOptions = {},
): Promise<Partial<RunResult>> {
  const input = await buildListingInput(ctx, options);
  const output = await runListing(input, ctx, options);

  return {
    agents: [output.agent],
    opportunities: markSelectedOpportunity(input.opportunities, output.selection.selected_opportunity_id),
    selected_listing: output.selected_listing,
  };
}

export async function runListing(
  input: ListingInput,
  ctx: Pick<AgentContext, "providers" | "risk">,
  options: RunListingAgentOptions = {},
): Promise<ListingOutput> {
  const featureVectors = buildFeatureVectors(input);
  const selection =
    input.mode === "live"
      ? await runLiveSelection(input, ctx, options, featureVectors)
      : buildHeuristicSelection(input, featureVectors);
  const normalizedSelection = normalizeSelection(input, selection, featureVectors);
  const selectedOpportunity = findSelectedOpportunity(input, normalizedSelection.selected_opportunity_id);
  const checkpoint = await ctx.risk.checkpoint("listing", {
    purpose: "rank_filter_before_packaging_handoff",
    selection: normalizedSelection,
    feature_vectors: featureVectors,
    market_context: input.evidence.market_context,
    policy_rule_ids: input.evidence.policy_rules.map((rule) => rule.id),
    risk_warnings: input.risk_warnings,
  });
  const selectedListing = buildPackagingHandoff(input, selectedOpportunity, normalizedSelection, featureVectors, checkpoint);
  const agent = buildAgentResult(input, normalizedSelection, featureVectors, checkpoint);
  const output: ListingOutput = {
    feature_vectors: featureVectors,
    selection: normalizedSelection,
    selected_listing: selectedListing,
    agent,
  };
  const validation = validateJsonSchema(listingOutputSchema, output);

  if (!validation.valid) {
    throw new Error(`Listing output failed schema validation: ${validation.errors.join("; ")}`);
  }

  return output;
}

export async function buildListingInput(
  ctx: AgentContext,
  options: RunListingAgentOptions = {},
): Promise<ListingInput> {
  const opportunities = ctx.results.opportunities ?? [];
  if (!opportunities.length) {
    throw new Error("Listing Ranker Agent requires ctx.results.opportunities from upstream market/sourcing/margin stages.");
  }

  const preferredOpportunityId =
    options.preferredOpportunityId ?? opportunities.find((opportunity) => opportunity.is_primary)?.id;
  const evidence = await collectToolEvidence(ctx, options.categoryId ?? DEFAULT_CATEGORY_ID);

  return {
    run_id: options.runId ?? ctx.results.run_id ?? "run_listing_preview",
    mode: options.mode ?? "fixture",
    brief: ctx.brief,
    opportunities,
    preferred_opportunity_id: preferredOpportunityId,
    evidence,
    risk_warnings: collectRiskWarnings(ctx),
  };
}

async function runLiveSelection(
  input: ListingInput,
  ctx: Pick<AgentContext, "providers">,
  options: RunListingAgentOptions,
  featureVectors: OpportunityFeatureVector[],
): Promise<ListingSelection> {
  const result = await runAgent<ListingInput & { deterministic_feature_vectors: OpportunityFeatureVector[] }, ListingSelection>({
    agentKey: "listing",
    skill: listingSkill,
    input: {
      ...input,
      deterministic_feature_vectors: featureVectors,
    },
    outputSchema: listingSelectionSchema,
    outputSchemaName: "listing_selection",
    tools: createListingTools(ctx.providers),
    mode: "live",
    runId: options.runId ?? input.run_id,
    model: options.model,
    apiKey: options.apiKey,
    audit: options.audit,
    maxToolCalls: 8,
  });

  return assertAgentSuccess(result);
}

async function collectToolEvidence(ctx: AgentContext, categoryId: number): Promise<ListingToolEvidence> {
  const [marketSearch, sourcingSearch, policyRules, categoryAttributes] = await Promise.all([
    ctx.providers.shopee
      .searchProducts({
        query: ctx.brief.product_intent,
        market: ctx.brief.target_market,
        category: ctx.brief.category,
        limit: 5,
      })
      .catch(() => undefined),
    ctx.providers.sourcing1688
      .searchOffers({
        query: ctx.brief.product_intent,
        limit: 3,
      })
      .catch(() => undefined),
    ctx.providers.shopee.getPolicyRules({ market: ctx.brief.target_market }).catch(() => undefined),
    ctx.providers.shopee.getCategoryAttributes({ categoryId }).catch(() => undefined),
  ]);
  const offerId = sourcingSearch?.offers[0]?.offer_id;
  const offerDetail = offerId ? await ctx.providers.sourcing1688.getOfferDetail({ offerId }).catch(() => undefined) : undefined;
  const shipping = offerDetail
    ? await ctx.providers.shipping
        .estimateCrossBorder({
          weight_g: offerDetail.offer.package_weight_g,
          dimensions_cm: offerDetail.offer.package_dimensions_cm,
          from: "CN",
          to: toShippingMarketCode(ctx.brief.target_market),
        })
        .catch(() => undefined)
    : undefined;
  const fx = offerDetail
    ? await ctx.providers.fx
        .convert({
          amount: offerDetail.offer.source_price_cny,
          from: "CNY",
          to: "SGD",
        })
        .catch(() => undefined)
    : undefined;

  return {
    market_search: marketSearch,
    sourcing_search: sourcingSearch,
    offer_detail: offerDetail,
    shipping,
    fx,
    policy_rules: policyRules?.rules ?? [],
    category_attributes: categoryAttributes,
    market_context: buildSingaporeMarketContext(ctx.brief.target_market, ctx.brief.category, ctx.brief.product_intent),
  };
}

function buildFeatureVectors(input: ListingInput): OpportunityFeatureVector[] {
  return input.opportunities.map((opportunity) => {
    const demand = clamp(scoreDemand(opportunity, input.evidence.market_search, input.evidence.market_context));
    const profit = clamp(opportunity.scores.profit);
    const sourcing = clamp(scoreSourcing(opportunity, input));
    const compliance = clamp(scoreCompliance(opportunity, input));
    const fulfillment = clamp(scoreFulfillment(opportunity, input.brief.max_fulfillment_days));
    const marketTiming = clamp(scoreMarketTiming(opportunity, input.evidence.market_context));
    const volatilityRisk = priceVolatilityRisk(opportunity, input);
    const priceStability = clamp(volatilityRisk === "high" ? 42 : volatilityRisk === "medium" ? 65 : 82);
    const overall = clamp(
      profit * 0.22 +
        demand * 0.16 +
        sourcing * 0.14 +
        compliance * 0.26 +
        fulfillment * 0.11 +
        marketTiming * 0.09 +
        priceStability * 0.05,
    );
    const status = initialStatus(opportunity, input.brief.max_fulfillment_days);
    const reasons = buildVectorReasons(opportunity, volatilityRisk, status, input);

    return {
      opportunity_id: opportunity.id,
      demand,
      profit,
      sourcing,
      compliance,
      fulfillment,
      market_timing: marketTiming,
      price_stability: priceStability,
      overall,
      status,
      price_volatility_risk: volatilityRisk,
      reasons,
      evidence: buildVectorEvidence(opportunity, input, volatilityRisk),
    };
  });
}

function buildHeuristicSelection(input: ListingInput, vectors: OpportunityFeatureVector[]): ListingSelection {
  const rankedVectors = [...vectors].sort((left, right) => right.overall - left.overall);
  const preferred = input.preferred_opportunity_id
    ? vectors.find((vector) => vector.opportunity_id === input.preferred_opportunity_id)
    : undefined;
  const selected =
    preferred && preferred.status !== "filtered"
      ? preferred
      : rankedVectors.find((vector) => vector.status !== "filtered") ?? rankedVectors[0];
  const selectedId = selected.opportunity_id;

  return {
    ranked_ids: rankedVectors.map((vector) => vector.opportunity_id),
    selected_opportunity_id: selectedId,
    factor_scores: vectors.map(toFactorScores),
    filters: vectors.map((vector) => ({
      opportunity_id: vector.opportunity_id,
      status: vector.opportunity_id === selectedId ? "selected" : vector.status,
      reasons: vector.reasons,
    })),
    tradeoffs: buildTradeoffs(input, vectors, selectedId),
    handoff_notes: buildHandoffNotes(input, selectedId, vectors),
  };
}

function normalizeSelection(
  input: ListingInput,
  selection: ListingSelection,
  vectors: OpportunityFeatureVector[],
): ListingSelection {
  const knownIds = new Set(input.opportunities.map((opportunity) => opportunity.id));
  const rankedIds = uniqueList(selection.ranked_ids.filter((id) => knownIds.has(id)));
  const fallback = buildHeuristicSelection(input, vectors);
  const selectedId = knownIds.has(selection.selected_opportunity_id)
    ? selection.selected_opportunity_id
    : fallback.selected_opportunity_id;

  return {
    ranked_ids: rankedIds.length ? rankedIds : fallback.ranked_ids,
    selected_opportunity_id: selectedId,
    factor_scores: mergeFactorScores(selection.factor_scores, vectors),
    filters: selection.filters.length ? selection.filters : fallback.filters,
    tradeoffs: selection.tradeoffs.length ? selection.tradeoffs : fallback.tradeoffs,
    handoff_notes: uniqueList([...selection.handoff_notes, ...fallback.handoff_notes]),
  };
}

function buildPackagingHandoff(
  input: ListingInput,
  opportunity: Opportunity,
  selection: ListingSelection,
  vectors: OpportunityFeatureVector[],
  checkpoint: RiskCheckpoint,
): SelectedListing {
  const category = input.evidence.category_attributes;
  const offer = input.evidence.offer_detail?.offer;
  const selectedVector = vectors.find((vector) => vector.opportunity_id === opportunity.id);
  const attributes = buildHandoffAttributes(input, opportunity);
  const shopee = buildShopeeHandoffDraft(input, opportunity, attributes);
  const missingFields = findMissingRequiredFields(shopee, category);
  const sanitizedShopee = sanitizeShopeeListing({
    ...shopee,
    required_fields_total: BASE_REQUIRED_FIELDS.length + (category?.attributes.filter((attribute) => attribute.required).length ?? 0),
    required_fields_filled:
      BASE_REQUIRED_FIELDS.length +
      (category?.attributes.filter((attribute) => attribute.required).length ?? 0) -
      missingFields.length,
    missing_fields: missingFields,
  });
  const complianceWarnings = uniqueList([
    ...input.risk_warnings,
    ...input.evidence.policy_rules
      .filter((rule) => rule.severity !== "info")
      .map((rule) => rule.guidance),
    ...selection.handoff_notes,
    ...checkpoint.warnings,
    ...(selectedVector?.price_volatility_risk === "high" ? ["Price volatility is high; Packaging should avoid aggressive price claims."] : []),
    ...(offer?.supplier_risk_notes ?? []),
  ]);

  return {
    opportunity_id: opportunity.id,
    platform: input.brief.target_platform,
    market: input.brief.target_market,
    language: input.brief.language || "en",
    shopee: sanitizedShopee,
    images: [] satisfies ListingImage[],
    compliance: {
      human_review_required:
        checkpoint.human_review_required ||
        opportunity.risk_level !== "low" ||
        complianceWarnings.some((warning) => includesNormalized(warning, "review")),
      warnings: complianceWarnings,
    },
    editable_json_ready: missingFields.length === 0 && !checkpoint.hard_block && opportunity.decision !== "Reject",
  };
}

function buildShopeeHandoffDraft(
  input: ListingInput,
  opportunity: Opportunity,
  attributes: Record<string, string>,
): ShopeeListing {
  const offer = input.evidence.offer_detail?.offer;
  const category = input.evidence.category_attributes;
  const productName = sanitizeText(`${opportunity.name} for ${input.brief.target_market} ${input.brief.target_platform}`);
  const useLimits = opportunity.risk_level === "low" ? "Ready for Packaging Agent localization." : "Manual review required before launch.";
  const shippingNote = input.evidence.shipping
    ? `Estimated cross-border delivery ${input.evidence.shipping.scenarios.base.days_min}-${input.evidence.shipping.scenarios.base.days_max} days.`
    : `Fulfillment estimate ${opportunity.fulfillment_days} days.`;

  return {
    item_name: productName,
    category: category?.category_name ?? input.brief.category,
    category_id: category?.category_id ?? DEFAULT_CATEGORY_ID,
    brand: attributes.Brand ?? "No Brand",
    condition: "New",
    price: opportunity.suggested_price,
    stock: opportunity.stock_status === "out" ? 0 : Math.min(offer?.available_stock ?? 100, 100),
    sku: buildSku(opportunity),
    variations: offer?.sku_options ?? [],
    attributes,
    description: sanitizeText(
      [
        `${opportunity.name} selected by tool-grounded ranking for Packaging Agent handoff.`,
        `Decision: ${opportunity.decision}. ${opportunity.decision_reason}`,
        useLimits,
        shippingNote,
      ].join("\n\n"),
    ),
    bullet_points: buildHandoffBulletPoints(input, opportunity),
    logistics: {
      weight_g: offer?.package_weight_g ?? 1,
      length_cm: offer?.package_dimensions_cm.length ?? 1,
      width_cm: offer?.package_dimensions_cm.width ?? 1,
      height_cm: offer?.package_dimensions_cm.height ?? 1,
    },
    required_fields_total: 0,
    required_fields_filled: 0,
    missing_fields: [],
  };
}

function buildHandoffAttributes(input: ListingInput, opportunity: Opportunity): Record<string, string> {
  const offer = input.evidence.offer_detail?.offer;
  const electrical =
    includesNormalized(opportunity.name, "vacuum") ||
    includesNormalized(opportunity.name, "usb") ||
    includesNormalized(input.brief.category, "appliance");

  return {
    Brand: "No Brand",
    "Power Source": electrical ? "USB rechargeable; supplier safety details require review" : "Not applicable",
    "Warranty Type": "Supplier warranty to verify before launch",
    Material: "Supplier specification required",
    "Package Weight": offer?.package_weight_g ? `${offer.package_weight_g}g` : "",
  };
}

function findMissingRequiredFields(
  listing: ShopeeListing,
  categoryAttributes: ListingToolEvidence["category_attributes"],
): string[] {
  const missing = BASE_REQUIRED_FIELDS.filter((field) => {
    const value = listing[field as keyof ShopeeListing];
    if (Array.isArray(value)) {
      return value.length === 0 && field !== "variations";
    }
    if (typeof value === "object") {
      return !value || Object.values(value).some((item) => item === "" || item === 0);
    }
    return value === "" || value === 0 || value === undefined;
  });
  const missingCategory = (categoryAttributes?.attributes ?? [])
    .filter((attribute) => attribute.required)
    .filter((attribute) => !listing.attributes[attribute.name])
    .map((attribute) => `attributes.${attribute.name}`);

  return uniqueList([...missing, ...missingCategory]);
}

function sanitizeShopeeListing(listing: ShopeeListing): ShopeeListing {
  return {
    ...listing,
    item_name: sanitizeText(listing.item_name),
    description: sanitizeText(listing.description),
    bullet_points: listing.bullet_points.map(sanitizeText),
  };
}

function buildAgentResult(
  input: ListingInput,
  selection: ListingSelection,
  vectors: OpportunityFeatureVector[],
  checkpoint: RiskCheckpoint,
): AgentResult {
  const selectedVector = vectors.find((vector) => vector.opportunity_id === selection.selected_opportunity_id);
  const topRanked = selection.ranked_ids[0];
  const warnings = uniqueList([
    ...input.risk_warnings,
    ...checkpoint.warnings,
    ...input.evidence.market_context.caveats,
    ...(selectedVector?.status === "filtered" ? ["Selected opportunity is filtered; Packaging handoff should not proceed automatically."] : []),
  ]);

  return {
    key: "listing",
    name: listingSkill.name,
    role: listingSkill.role,
    status: checkpoint.hard_block ? "blocked" : "done",
    inputs_summary: `${input.opportunities.length} opportunities · ${input.brief.target_market} · tool-grounded rank/filter`,
    data_sources: uniqueList([
      "Shopee SG search seed",
      "1688 sourcing seed",
      "Shipping seed",
      "FX seed",
      "Shopee SG policy rules seed",
      "Singapore market context seed",
      "Risk checkpoint(listing)",
    ]),
    evidence: [
      {
        label: "Ranked opportunities",
        value: selection.ranked_ids.join(" > "),
      },
      {
        label: "Packaging handoff",
        value: `${selection.selected_opportunity_id} (${selectedVector?.overall ?? "n/a"})`,
      },
      {
        label: "Top ranked",
        value: topRanked,
      },
      ...buildContextEvidence(input.evidence.market_context),
    ],
    key_judgment:
      topRanked === selection.selected_opportunity_id
        ? "Tool-grounded ranking selected the top viable opportunity for Packaging handoff."
        : "Tool-grounded ranking found a safer top candidate, but kept the viable upstream primary for Packaging handoff with warnings.",
    score: Math.round(selectedVector?.overall ?? 50),
    confidence: input.evidence.market_context.freshness === "live" ? 0.82 : 0.68,
    warnings,
  };
}

function scoreDemand(
  opportunity: Opportunity,
  marketSearch: ListingToolEvidence["market_search"],
  marketContext: MarketContextResult,
): number {
  const heat = opportunity.market_heat === "high" ? 78 : opportunity.market_heat === "medium" ? 62 : 42;
  const reviewDensity = marketSearch?.products.length
    ? Math.min(12, marketSearch.products.reduce((sum, product) => sum + product.review_count, 0) / marketSearch.products.length / 50)
    : 0;
  const localBoost = marketContext.recent_signals.some((signal) => signal.confidence > 0.7) ? 4 : 0;
  return heat + reviewDensity + localBoost;
}

function scoreSourcing(opportunity: Opportunity, input: ListingInput): number {
  const stock = opportunity.stock_status === "in_stock" ? 82 : opportunity.stock_status === "low" ? 55 : 20;
  const offer = input.evidence.offer_detail?.offer;
  const moqPenalty = offer && offer.moq > 5 ? 8 : 0;
  const riskPenalty = (offer?.supplier_risk_notes.length ?? 0) * 4;
  return stock - moqPenalty - riskPenalty;
}

function scoreCompliance(opportunity: Opportunity, input: ListingInput): number {
  const base = opportunity.risk_level === "low" ? 88 : opportunity.risk_level === "medium" ? 58 : 30;
  const policyPenalty = input.evidence.policy_rules.some((rule) => rule.severity === "hard_block") ? 0 : 0;
  return base - policyPenalty;
}

function scoreFulfillment(opportunity: Opportunity, maxFulfillmentDays: number): number {
  if (opportunity.fulfillment_days > maxFulfillmentDays) {
    return Math.max(20, 60 - (opportunity.fulfillment_days - maxFulfillmentDays) * 8);
  }
  return Math.max(45, 88 - opportunity.fulfillment_days * 2);
}

function scoreMarketTiming(opportunity: Opportunity, marketContext: MarketContextResult): number {
  const localUseBoost = marketContext.local_use_cases.some((useCase) => includesNormalized(opportunity.name, "desk") && includesNormalized(useCase, "desk"))
    ? 8
    : 0;
  const caveatPenalty = marketContext.freshness === "live" ? 0 : 8;
  return (opportunity.market_heat === "high" ? 72 : opportunity.market_heat === "medium" ? 62 : 48) + localUseBoost - caveatPenalty;
}

function priceVolatilityRisk(opportunity: Opportunity, input: ListingInput): PriceVolatilityRisk {
  const marginSpread = opportunity.margin
    ? Math.abs(opportunity.margin.high.net_margin - opportunity.margin.low.net_margin)
    : Math.abs(opportunity.gross_margin - opportunity.minimum_viable_price / Math.max(opportunity.suggested_price, 1));
  const lowStock = opportunity.stock_status === "low" || input.evidence.offer_detail?.offer.available_stock === 0;
  const shippingHigh = input.evidence.shipping
    ? input.evidence.shipping.scenarios.high.cost_sgd - input.evidence.shipping.scenarios.base.cost_sgd > 0.6
    : false;

  if (marginSpread > 0.22 || lowStock || shippingHigh) {
    return "high";
  }
  if (marginSpread > 0.12 || opportunity.risk_level === "medium") {
    return "medium";
  }
  return "low";
}

function initialStatus(opportunity: Opportunity, maxFulfillmentDays: number): ListingFilterStatus {
  if (opportunity.decision === "Reject" || opportunity.stock_status === "out" || opportunity.fulfillment_days > maxFulfillmentDays) {
    return "filtered";
  }
  return "candidate";
}

function buildVectorReasons(
  opportunity: Opportunity,
  volatilityRisk: PriceVolatilityRisk,
  status: ListingFilterStatus,
  input: ListingInput,
): string[] {
  return uniqueList([
    `${opportunity.decision}: ${opportunity.decision_reason}`,
    `market heat ${opportunity.market_heat}, risk ${opportunity.risk_level}, fulfillment ${opportunity.fulfillment_days} days`,
    `price volatility risk ${volatilityRisk}`,
    ...(status === "filtered" ? ["Filtered by hard gate before Packaging handoff."] : []),
    ...(input.preferred_opportunity_id === opportunity.id ? ["Upstream primary/user-preferred opportunity."] : []),
  ]);
}

function buildVectorEvidence(
  opportunity: Opportunity,
  input: ListingInput,
  volatilityRisk: PriceVolatilityRisk,
): Evidence[] {
  return [
    { label: "Profit score", value: String(opportunity.scores.profit) },
    { label: "Demand score", value: String(opportunity.scores.demand) },
    { label: "Compliance score", value: String(opportunity.scores.compliance) },
    {
      label: "Market evidence",
      value: input.evidence.market_search
        ? `${input.evidence.market_search.competitor_count} Shopee seed competitors, median SGD ${input.evidence.market_search.price_band.median}`
        : "No market search evidence available",
    },
    {
      label: "Sourcing evidence",
      value: input.evidence.offer_detail
        ? `${input.evidence.offer_detail.offer.supplier_name}, stock ${input.evidence.offer_detail.offer.available_stock}`
        : "No sourcing detail available",
    },
    { label: "Price volatility", value: volatilityRisk },
  ];
}

function buildTradeoffs(input: ListingInput, vectors: OpportunityFeatureVector[], selectedId: string): ListingSelection["tradeoffs"] {
  return vectors
    .filter((vector) => vector.opportunity_id === selectedId || vector.status === "filtered")
    .map((vector) => {
      const opportunity = findSelectedOpportunity(input, vector.opportunity_id);
      return {
        opportunity_id: vector.opportunity_id,
        conflict: `${opportunity.decision} · risk ${opportunity.risk_level} · volatility ${vector.price_volatility_risk}`,
        resolution:
          vector.status === "filtered"
            ? "Filtered before Packaging handoff."
            : "Allowed into Packaging handoff with risk and pricing warnings preserved.",
      };
    });
}

function buildHandoffNotes(input: ListingInput, selectedId: string, vectors: OpportunityFeatureVector[]): string[] {
  const selected = findSelectedOpportunity(input, selectedId);
  const vector = vectors.find((candidate) => candidate.opportunity_id === selectedId);
  return uniqueList([
    `Packaging Agent receives ${selected.name}; Listing Ranker does not publish or finalize the listing.`,
    `Use suggested price SGD ${selected.suggested_price}; do not undercut minimum viable price SGD ${selected.minimum_viable_price}.`,
    ...(vector?.price_volatility_risk !== "low" ? [`Price volatility risk is ${vector?.price_volatility_risk}; keep claims and discounts conservative.`] : []),
    ...(selected.risk_level !== "low" ? ["Human review warning must remain visible in Packaging output."] : []),
  ]);
}

function buildHandoffBulletPoints(input: ListingInput, opportunity: Opportunity): string[] {
  const localUseCases = input.evidence.market_context.local_use_cases.slice(0, 2).join(", ");
  return [
    `${opportunity.name} selected for ${input.brief.target_market} ${input.brief.target_platform} Packaging handoff`,
    `Suggested price SGD ${opportunity.suggested_price}; minimum viable SGD ${opportunity.minimum_viable_price}`,
    localUseCases ? `Local use cases: ${localUseCases}` : "Local use cases require Packaging Agent localization",
    opportunity.risk_level === "low" ? "Low compliance risk from current evidence" : "Compliance warning must be reviewed before launch",
  ].map(sanitizeText);
}

function markSelectedOpportunity(opportunities: Opportunity[], selectedId: string): Opportunity[] {
  return opportunities.map((opportunity) => ({
    ...opportunity,
    is_primary: opportunity.id === selectedId,
  }));
}

function toFactorScores(vector: OpportunityFeatureVector): OpportunityFactorScores {
  return {
    opportunity_id: vector.opportunity_id,
    demand: vector.demand,
    profit: vector.profit,
    sourcing: vector.sourcing,
    compliance: vector.compliance,
    fulfillment: vector.fulfillment,
    market_timing: vector.market_timing,
    price_stability: vector.price_stability,
    overall: vector.overall,
  };
}

function mergeFactorScores(
  modelScores: OpportunityFactorScores[],
  vectors: OpportunityFeatureVector[],
): OpportunityFactorScores[] {
  const byId = new Map(modelScores.map((score) => [score.opportunity_id, score]));
  return vectors.map((vector) => {
    const score = byId.get(vector.opportunity_id);
    return score ? normalizeScore(score, vector) : toFactorScores(vector);
  });
}

function normalizeScore(score: OpportunityFactorScores, fallback: OpportunityFeatureVector): OpportunityFactorScores {
  return {
    opportunity_id: score.opportunity_id,
    demand: clamp(score.demand),
    profit: clamp(score.profit),
    sourcing: clamp(score.sourcing),
    compliance: clamp(score.compliance),
    fulfillment: clamp(score.fulfillment),
    market_timing: clamp(score.market_timing),
    price_stability: clamp(score.price_stability),
    overall: clamp(score.overall || fallback.overall),
  };
}

function buildContextEvidence(context: MarketContextResult): Evidence[] {
  return context.recent_signals.slice(0, 3).map((signal) => ({
    label: signal.label,
    value: signal.value,
  }));
}

function findSelectedOpportunity(input: ListingInput, selectedId: string): Opportunity {
  const opportunity = input.opportunities.find((candidate) => candidate.id === selectedId);
  if (!opportunity) {
    throw new Error(`Selected opportunity not found: ${selectedId}`);
  }
  return opportunity;
}

function collectRiskWarnings(ctx: AgentContext): string[] {
  return ctx.results.agents?.filter((agent) => agent.key === "risk").flatMap((agent) => agent.warnings) ?? [];
}

function toShippingMarketCode(market: string): string {
  return includesNormalized(market, "singapore") ? "SG" : market;
}

function buildSku(opportunity: Opportunity): string {
  const tokens = opportunity.name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 4)
    .map((token) => token.slice(0, 3));
  return tokens.length ? tokens.join("-") : opportunity.id.toUpperCase();
}

function sanitizeText(value: string): string {
  let output = value;
  for (const claim of BANNED_CLAIMS) {
    output = output.replace(new RegExp(escapeRegExp(claim), "gi"), "");
  }
  return output.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

function includesNormalized(value: string, term: string): boolean {
  return normalize(value).includes(normalize(term));
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = normalize(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
