import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { AgentResult, Brief, Opportunity, SelectedListing } from "../../../contract/result";
import { FileAuditSink, createAuditRunId, nowIso } from "../../agent-runtime/audit";
import type { ProviderSource } from "../../providers/shared";
import type {
  BrowserRetrievalProvider,
  Browser1688OfferDetail,
  Browser1688OfferResult,
  BrowserShopeeSearchResult,
  BrowserTaobaoSearchResult,
  Browser1688SearchResult,
  FxConvertInput,
  FxConvertResult,
  FxProvider,
  ShippingEstimateResult,
  ShippingProvider,
} from "../../providers";
import { createShippingProviderFromEnv } from "../../providers";
import {
  createCdpChromeBrowserController,
  createChromeBrowserRetrievalProvider,
} from "../../providers/browser-retrieval";
import { createOpenAIImageProvider } from "../../providers/openai-image";
import { computeMargin } from "../margin/calculator";
import type { MarginAssumptions } from "../margin/assumptions";
import { createRiskSupervisor } from "../risk";
import { aggregateRisk } from "../risk/aggregate";

loadEnvLocal();

const live = process.env.LIVE_PRECOMMITTEE_TESTS === "1";
const PRODUCT_QUERY_EN = "mini desk vacuum";
const PRODUCT_QUERY_ZH = "桌面吸尘器";
const PRODUCT_CODE = process.env.LIVE_PRODUCT_CODE ?? "SEA-MDV-SG-001";
const OPPORTUNITY_ID = "opp_sea_mdv_sg_001";
const TARGET_MARKET = "Singapore";
const TARGET_PLATFORM = "Shopee";
const LOGISTICS_PROVIDER = process.env.LOGISTICS_PROVIDER ?? "seed";
const LOGISTICS_QUOTE_MODE = process.env.LOGISTICS_QUOTE_MODE ?? "freight_only";
const AUDIT_ROOT = process.env.LIVE_AUDIT_ROOT ?? "/private/tmp/sea-launch-live-audit";
const SCREENSHOT_ROOT = process.env.LIVE_BROWSER_SCREENSHOT_DIR ?? "/private/tmp/sea-launch-browser-screens";
const CHROME_ENDPOINT = process.env.CHROME_CDP_ENDPOINT ?? "http://127.0.0.1:9223";

type StageStatus = "passed" | "partial" | "blocked" | "failed";

interface StageRecord {
  name: string;
  status: StageStatus;
  output_path: string;
  summary: string;
  blockers?: string[];
}

interface StageWriter {
  runId: string;
  auditDir: string;
  stages: StageRecord[];
  write(name: string, status: StageStatus, data: Record<string, unknown>, summary: string, blockers?: string[]): Promise<void>;
}

describe.skipIf(!live)("pre-committee live real-data integration", () => {
  it(
    "audits market, sourcing, margin, risk, listing readiness, and packaging image readiness without seed fallback",
    async () => {
      const runId = createAuditRunId("live_precommittee");
      const writer = await createStageWriter(runId);
      const audit = new FileAuditSink(writer.auditDir);
      const brief = buildBrief();
      const browser = createBrowserProvider(runId);
      const fx = createFrankfurterFxProvider();
      const shipping = createShippingProviderFromEnv();
      const risk = createRiskSupervisor();

      await writer.write(
        "preflight",
        preflightStatus(),
        {
          run_id: runId,
          product_query_en: PRODUCT_QUERY_EN,
          product_query_zh: PRODUCT_QUERY_ZH,
          product_code: PRODUCT_CODE,
          openai_key_present: Boolean(process.env.OPENAI_API_KEY),
          logistics_provider: LOGISTICS_PROVIDER,
          easyship_key_present: Boolean(process.env.EASYSHIP_API_KEY),
          demo_mock_only: process.env.DEMO_MOCK_ONLY ?? "",
          logistics_quote_mode: LOGISTICS_QUOTE_MODE,
          hs_code_provider: process.env.HS_CODE_PROVIDER ?? "",
          tax_duty_provider: process.env.TAX_DUTY_PROVIDER ?? "",
          chrome_endpoint: CHROME_ENDPOINT,
          audit_dir: writer.auditDir,
          real_data_policy: "seed, fixture, mock, and image fallback outputs are blockers for this live test.",
        },
        "Real-data preflight completed.",
        preflightBlockers(),
      );

      const market = await runMarketStage(browser, writer);
      const sourcing = await runSourcingStage(browser, writer);
      const detail = sourcing ? await runSourcingDetailStage(browser, sourcing, market, writer) : undefined;
      const selectedOffer = detail?.offer;
      const fxQuote = selectedOffer ? await runFxStage(fx, selectedOffer.source_price_cny, writer) : undefined;
      const productSpecs = deriveRealProductSpecs(selectedOffer);
      const shippingQuote =
        selectedOffer && productSpecs
          ? await runShippingStage(shipping, productSpecs.weight_g, productSpecs.dimensions_cm, writer)
          : await writeBlockedShipping(writer, selectedOffer);
      const opportunity =
        selectedOffer && fxQuote && shippingQuote && productSpecs
          ? await runMarginStage(brief, market, selectedOffer, fxQuote, shippingQuote, writer, risk)
          : await writeBlockedMargin(brief, market, selectedOffer, fxQuote, shippingQuote, writer);

      const aggregateBeforeListing = aggregateRisk(risk.getCheckpoints());
      await writer.write(
        "risk.margin",
        risk.getCheckpoints().length ? "passed" : "blocked",
        { checkpoints: risk.getCheckpoints(), aggregate: aggregateBeforeListing },
        "Risk margin checkpoint recorded.",
        risk.getCheckpoints().length ? [] : ["Margin checkpoint did not run because real margin inputs were incomplete."],
      );

      const listing = opportunity
        ? await runListingReadinessStage(brief, opportunity, selectedOffer!, productSpecs, writer, risk, audit)
        : await writeBlockedListing(writer);
      const packaging = listing
        ? await runPackagingImageReadinessStage(brief, listing, market, writer, risk)
        : process.env.LIVE_IMAGE_SMOKE_ON_BLOCKED === "1"
          ? await runPackagingImageSmokeStage(brief, market, writer, risk)
          : await writeBlockedPackaging(writer);

      const aggregate = aggregateRisk(risk.getCheckpoints());
      await writer.write(
        "risk.aggregate",
        aggregate.status === "blocked" ? "blocked" : "passed",
        { aggregate, checkpoints: risk.getCheckpoints() },
        "Risk checkpoints aggregated before Committee.",
        aggregate.status === "blocked" ? aggregate.warnings : [],
      );

      const summary = await writeSummary(writer, {
        run_id: runId,
        audit_run_id: runId,
        brief,
        product_code: PRODUCT_CODE,
        logistics_quote_mode: LOGISTICS_QUOTE_MODE,
        market_status: statusOf(writer, "market"),
        sourcing_status: statusOf(writer, "sourcing"),
        sourcing_detail_status: statusOf(writer, "sourcing.detail"),
        fx_status: statusOf(writer, "fx"),
        shipping_status: statusOf(writer, "shipping"),
        margin_status: statusOf(writer, "margin"),
        listing_status: statusOf(writer, "listing"),
        packaging_status: statusOf(writer, "packaging"),
        risk_level: aggregate.risk_level ?? "low",
        human_review_required: aggregate.warnings.length > 0,
        committee_skipped: true,
        selected_listing_ready: Boolean(listing && packaging),
        known_code_gaps: [
          "app/api/run live route is still not wired.",
          "Live harness uses the configured shipping provider; set LOGISTICS_PROVIDER=easyship for live rates.",
          "Main FX provider is seed-only; this live harness uses Frankfurter.",
          "1688/Taobao offer detail parser can block package dimensions if they are not visible.",
        ],
      });

      expectNoSeedStages(writer.stages);
      expect(summary.stage_counts.failed).toBe(0);
      if (process.env.LIVE_REQUIRE_FULL_PRECOMMITTEE === "1") {
        expect(summary.stage_counts.blocked).toBe(0);
      }
    },
    240_000,
  );
});

async function runMarketStage(browser: BrowserRetrievalProvider, writer: StageWriter): Promise<BrowserShopeeSearchResult> {
  try {
    const [search, trend, ads] = await Promise.allSettled([
      browser.extractShopeeSearch({
        query: PRODUCT_QUERY_EN,
        market: TARGET_MARKET,
        category: "home_appliances_small",
        limit: 8,
      }),
      browser.extractWebTrend({
        query: PRODUCT_QUERY_EN,
        market: TARGET_MARKET,
        limit: 5,
      }),
      browser.extractShopeeAdsSignals({
        market: TARGET_MARKET,
        query: PRODUCT_QUERY_EN,
      }),
    ]);
    if (search.status !== "fulfilled") {
      throw search.reason;
    }
    assertBrowserSource(search.value.source, "market Shopee search");
    const products = search.value.products;
    const blockers = products.length ? [] : ["Shopee browser search returned no parseable product rows."];

    await writer.write(
      "market",
      blockers.length ? "blocked" : "passed",
      {
        demand_signal_score: demandScore(search.value),
        competitor_count: search.value.competitor_count,
        price_band: search.value.price_band,
        review_density: {
          top_review_count: Math.max(...products.map((product) => product.review_count), 0),
          reviewed_listing_count: products.filter((product) => product.review_count > 0).length,
        },
        rating_distribution: {
          min: products.length ? Math.min(...products.map((product) => product.rating)) : 0,
          max: products.length ? Math.max(...products.map((product) => product.rating)) : 0,
        },
        trend: settledValue(trend),
        ads: settledValue(ads),
        source: search.value.source,
        products,
      },
      `Shopee browser search returned ${products.length} parseable product rows.`,
      blockers,
    );
    return search.value;
  } catch (error) {
    await writer.write("market", "failed", { error: errorMessage(error) }, "Market live extraction failed.", [errorMessage(error)]);
    throw error;
  }
}

async function runSourcingStage(
  browser: BrowserRetrievalProvider,
  writer: StageWriter,
): Promise<{ primary: Browser1688SearchResult | BrowserTaobaoSearchResult; secondary?: Browser1688SearchResult | BrowserTaobaoSearchResult } | undefined> {
  const results = await Promise.allSettled([
    browser.extract1688Search({ query: PRODUCT_QUERY_ZH, limit: 8 }),
    browser.extractTaobaoSearch({ query: PRODUCT_QUERY_ZH, limit: 8 }),
  ]);
  const fulfilled = results
    .filter((result): result is PromiseFulfilledResult<Browser1688SearchResult | BrowserTaobaoSearchResult> => result.status === "fulfilled")
    .map((result) => result.value)
    .filter((result) => result.offers.length > 0);
  const errors = results.filter((result): result is PromiseRejectedResult => result.status === "rejected").map((result) => errorMessage(result.reason));
  const primary = fulfilled[0];

  if (!primary) {
    await writer.write(
      "sourcing",
      "blocked",
      { errors, results: results.map(settledValue) },
      "No parseable live 1688/Taobao sourcing rows were available.",
      ["Human login/verification or parser update is required before sourcing can pass."],
    );
    return undefined;
  }

  assertBrowserSource(primary.source, "sourcing search");
  const detailBlockers = [
    "Search rows prove sourcing candidates only; sourcing.detail must prove comparable package specs.",
    "Package weight/dimensions are not trusted until visible on a parsed detail page.",
  ];
  await writer.write(
    "sourcing",
    "partial",
    {
      selected_source: primary.source,
      primary,
      secondary: fulfilled[1],
      errors,
      detail_blockers: detailBlockers,
    },
    `Live sourcing returned ${primary.offers.length} visible offers; detail extraction still needs proven package specs.`,
    detailBlockers,
  );
  return { primary, secondary: fulfilled[1] };
}

async function runSourcingDetailStage(
  browser: BrowserRetrievalProvider,
  sourcing: { primary: Browser1688SearchResult | BrowserTaobaoSearchResult; secondary?: Browser1688SearchResult | BrowserTaobaoSearchResult },
  market: BrowserShopeeSearchResult,
  writer: StageWriter,
): Promise<Browser1688OfferResult | undefined> {
  const userSuppliedCandidates = readUserSuppliedDetailUrls();
  const candidates = [...userSuppliedCandidates, ...sourcing.primary.offers, ...(sourcing.secondary?.offers ?? [])]
    .filter((offer) => offer.source_url)
    .filter(uniqueOfferUrl)
    .sort((left, right) => left.source_price_cny - right.source_price_cny)
    .slice(0, Number(process.env.LIVE_DETAIL_CANDIDATE_LIMIT ?? 5));
  const attempts: Array<Record<string, unknown>> = [];

  for (const offer of candidates) {
    const url = offer.source_url;
    if (!url) {
      continue;
    }
    const result = await (isTaobaoUrl(url) ? browser.extractTaobaoOffer({ offerId: offer.offer_id, url }) : browser.extract1688Offer({ offerId: offer.offer_id, url }));
    attempts.push({ offer_id: offer.offer_id, url, result });
    if ("available" in result) {
      continue;
    }
    const blockers = comparableSpecBlockers(result.offer, market);
    if (blockers.length === 0) {
      await writer.write(
        "sourcing.detail",
        "passed",
        {
          selected_detail: result,
          attempts,
          comparable_spec_policy:
            "Margin can proceed only when the source detail page exposes product title, source price, package weight, package dimensions, stock signal, and supplier/shop info.",
        },
        "Live detail page exposed comparable SKU specs for margin.",
      );
      return result;
    }
    attempts[attempts.length - 1].comparable_spec_blockers = blockers;
  }

  await writer.write(
    "sourcing.detail",
    "blocked",
    {
      candidates: candidates.map((offer) => ({
        offer_id: offer.offer_id,
        title: offer.title,
        source_price_cny: offer.source_price_cny,
        source_url: offer.source_url,
      })),
      attempts,
    },
    "No live sourcing detail page produced comparable package specs.",
    [
      "Open a 1688/Taobao detail page for the selected SKU in Chrome, or log in if the page hides package specs.",
      "Margin remains blocked until weight, dimensions, stock, and supplier/shop fields are visible from a real detail page.",
    ],
  );
  return undefined;
}

function readUserSuppliedDetailUrls(): Browser1688SearchResult["offers"] {
  return (process.env.LIVE_DETAIL_URLS ?? "")
    .split(/[\n,]+/)
    .map((url) => url.trim())
    .filter(Boolean)
    .map((url, index) => ({
      offer_id: `user_detail_${index + 1}`,
      title: `User supplied sourcing detail URL ${index + 1}`,
      source_price_cny: 0,
      currency: "CNY" as const,
      moq: 1,
      available_stock: 0,
      supplier_name: "User supplied detail URL",
      supplier_location: "Unknown",
      domestic_dispatch_days: 3,
      source_url: url,
      evidence_label: `User supplied detail URL: ${url}`,
    }));
}

function uniqueOfferUrl(
  offer: Browser1688SearchResult["offers"][number],
  index: number,
  offers: Browser1688SearchResult["offers"],
): boolean {
  return offers.findIndex((candidate) => candidate.source_url === offer.source_url) === index;
}

async function runFxStage(provider: FxProvider, amount: number, writer: StageWriter): Promise<FxConvertResult> {
  const result = await provider.convert({ amount, from: "CNY", to: "SGD" });
  assertLiveSource(result.source, "FX");
  await writer.write("fx", "passed", result as unknown as Record<string, unknown>, "Frankfurter CNY->SGD quote completed.");
  return result;
}

async function runShippingStage(
  provider: ShippingProvider,
  weightG: number,
  dimensionsCm: { length: number; width: number; height: number },
  writer: StageWriter,
): Promise<ShippingEstimateResult | undefined> {
  try {
    const result = await provider.estimateCrossBorder({
      weight_g: weightG,
      dimensions_cm: dimensionsCm,
      from: "CN",
      to: "SG",
    });
    assertLiveSource(result.source, "shipping");
    await writer.write("shipping", "passed", result as unknown as Record<string, unknown>, "Live shipping provider returned cross-border rates.");
    return result;
  } catch (error) {
    await writer.write(
      "shipping",
      "blocked",
      { error: errorMessage(error), weight_g: weightG, dimensions_cm: dimensionsCm },
      "Live shipping request did not produce usable CN->SG rates.",
      [errorMessage(error)],
    );
    return undefined;
  }
}

async function writeBlockedShipping(writer: StageWriter, selectedOffer: Browser1688SearchResult["offers"][number] | undefined): Promise<undefined> {
  await writer.write(
    "shipping",
    "blocked",
    { selected_offer: selectedOffer },
    "Shipping skipped because real package weight/dimensions were not available.",
    ["No real package dimensions/weight from source detail page; seed shipping is forbidden."],
  );
  return undefined;
}

async function runMarginStage(
  brief: Brief,
  market: BrowserShopeeSearchResult,
  selectedOffer: Browser1688SearchResult["offers"][number],
  fxQuote: FxConvertResult,
  shippingQuote: ShippingEstimateResult,
  writer: StageWriter,
  risk: ReturnType<typeof createRiskSupervisor>,
): Promise<Opportunity> {
  const suggestedPrice = market.price_band.median || market.products[0]?.price_sgd || 0;
  const baseAssumptions = buildAssumptions(fxQuote.amount, fxQuote.rate, shippingQuote.scenarios.base.cost_sgd);
  const lowAssumptions = buildAssumptions(fxQuote.amount, fxQuote.rate, shippingQuote.scenarios.high.cost_sgd, 1.5);
  const highAssumptions = buildAssumptions(fxQuote.amount, fxQuote.rate, shippingQuote.scenarios.low.cost_sgd, 0.75);
  const margin = computeMargin({
    sellingPrice: suggestedPrice,
    base: baseAssumptions,
    low: lowAssumptions,
    high: highAssumptions,
    targetMargin: brief.target_margin,
  });
  await risk.checkpoint("margin", {
    opportunity_id: OPPORTUNITY_ID,
    margin,
    target_margin: brief.target_margin,
  });
  const opportunity: Opportunity = {
    id: OPPORTUNITY_ID,
    is_primary: true,
    name: "Mini Desk Vacuum",
    direction: "Compact USB desk and keyboard cleaning appliance",
    target_market: brief.target_market,
    target_platform: brief.target_platform,
    source_price: fxQuote.converted_amount,
    suggested_price: suggestedPrice,
    minimum_viable_price: margin.minimum_viable_price,
    gross_margin: suggestedPrice ? (suggestedPrice - fxQuote.converted_amount) / suggestedPrice : 0,
    stock_status: selectedOffer.available_stock > 100 ? "in_stock" : "low",
    fulfillment_days: selectedOffer.domestic_dispatch_days + shippingQuote.scenarios.base.days_max,
    market_heat: market.competitor_count > 4 ? "high" : "medium",
    risk_level: "medium",
    decision: "Watch",
    decision_reason: "Pre-committee live test candidate; final decision belongs to Committee.",
    scores: {
      demand: demandScore(market),
      profit: margin.base.net_margin >= brief.target_margin ? 72 : 48,
      compliance: 58,
      fulfillment: 60,
      packaging: 0,
      overall: 60,
    },
    margin,
    key_reasons: [
      `Live Shopee price band median SGD ${suggestedPrice}`,
      `Live sourcing price CNY ${selectedOffer.source_price_cny}`,
      `Live FX converted source price SGD ${fxQuote.converted_amount}`,
    ],
  };

  await writer.write(
    "margin",
    "passed",
    { opportunity, margin, inputs: { market: market.source, fx: fxQuote.source, shipping: shippingQuote.source } },
    `Deterministic margin computed from live source price, FX, and ${LOGISTICS_PROVIDER} ${LOGISTICS_QUOTE_MODE} shipping.`,
  );
  return opportunity;
}

async function writeBlockedMargin(
  brief: Brief,
  market: BrowserShopeeSearchResult,
  selectedOffer: Browser1688SearchResult["offers"][number] | undefined,
  fxQuote: FxConvertResult | undefined,
  shippingQuote: ShippingEstimateResult | undefined,
  writer: StageWriter,
): Promise<undefined> {
  await writer.write(
    "margin",
    "blocked",
    {
      target_margin: brief.target_margin,
      market_source: market.source,
      selected_offer: selectedOffer,
      fx_source: fxQuote?.source,
      shipping_source: shippingQuote?.source,
    },
    "Margin skipped because complete real cost inputs were not available.",
    ["Margin requires real source price, FX, package specs, and shipping; seed assumptions are forbidden."],
  );
  return undefined;
}

async function runListingReadinessStage(
  brief: Brief,
  opportunity: Opportunity,
  selectedOffer: Browser1688SearchResult["offers"][number],
  productSpecs: ProductSpecs | undefined,
  writer: StageWriter,
  risk: ReturnType<typeof createRiskSupervisor>,
  _audit: FileAuditSink,
): Promise<SelectedListing | undefined> {
  if (!productSpecs) {
    return writeBlockedListing(writer);
  }
  const listing: SelectedListing = {
    opportunity_id: opportunity.id,
    platform: brief.target_platform,
    market: brief.target_market,
    language: brief.language,
    shopee: {
      item_name: "Mini Desk Vacuum for Desk and Keyboard Dry Dust",
      category: brief.category,
      category_id: 100636,
      brand: "No Brand",
      condition: "New",
      price: opportunity.suggested_price,
      stock: Math.max(0, Math.min(selectedOffer.available_stock, 100)),
      sku: PRODUCT_CODE,
      variations: [],
      attributes: {
        Brand: "No Brand",
        "Power Source": "USB rechargeable; supplier safety details require review",
        Material: "Supplier specification required",
      },
      description:
        "Compact mini desk vacuum for dry crumbs and light desktop dust. Not for wet mess, floor cleaning, or heavy debris. USB/electrical safety details require seller review before launch.",
      bullet_points: [
        "For dry desktop crumbs and keyboard dust",
        "Compact desk accessory for home office use",
        "USB/electrical details require review before launch",
      ],
      logistics: {
        weight_g: productSpecs.weight_g,
        length_cm: productSpecs.dimensions_cm.length,
        width_cm: productSpecs.dimensions_cm.width,
        height_cm: productSpecs.dimensions_cm.height,
      },
      required_fields_total: 12,
      required_fields_filled: 10,
      missing_fields: ["Material supplier specification", "Warranty details"],
    },
    images: [],
    compliance: {
      human_review_required: true,
      warnings: ["USB/electrical safety details require human review.", "Avoid exaggerated suction claims."],
    },
    editable_json_ready: false,
  };
  const checkpoint = await risk.checkpoint("listing", {
    title: listing.shopee.item_name,
    description: listing.shopee.description,
    bullet_points: listing.shopee.bullet_points,
    category: brief.category,
    brand: listing.shopee.brand,
  });

  await writer.write(
    "listing",
    checkpoint.hard_block ? "blocked" : "passed",
    { selected_listing: listing, checkpoint },
    "Listing readiness draft built from live upstream evidence and deterministic risk checkpoint.",
    checkpoint.hard_block ? checkpoint.warnings : [],
  );
  return checkpoint.hard_block ? undefined : listing;
}

async function writeBlockedListing(writer: StageWriter): Promise<undefined> {
  await writer.write(
    "listing",
    "blocked",
    {},
    "Listing skipped because upstream real sourcing/margin inputs were incomplete.",
    ["Listing needs real package specs and margin result before Packaging handoff."],
  );
  return undefined;
}

async function runPackagingImageReadinessStage(
  brief: Brief,
  listing: SelectedListing,
  market: BrowserShopeeSearchResult,
  writer: StageWriter,
  risk: ReturnType<typeof createRiskSupervisor>,
): Promise<boolean> {
  const imageProvider = createOpenAIImageProvider({
    mode: "live",
    model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
    outputRoot: join(writer.auditDir, "generated-images"),
    publicBasePath: `/generated-live/${writer.runId}`,
  });
  const prompts = [
    {
      type: "hero" as const,
      prompt:
        "Shopee Singapore ecommerce hero image for a compact mini desk vacuum. Show one small tabletop cleaner on a clean white background. Grounded attributes: compact desk accessory, dry crumbs and light desktop dust only, USB details require review. No text, no logo, no badge, no certification mark, no exaggerated suction effect.",
    },
    {
      type: "lifestyle" as const,
      prompt:
        "Realistic Singapore HDB home office desk lifestyle image showing a compact mini desk vacuum beside a keyboard and dry crumbs. Keep the setup practical and small-space friendly. No wet mess, heavy debris, floor cleaning, car cleaning, children, dramatic airflow, or certification badge.",
    },
    {
      type: "feature" as const,
      prompt:
        "Simple Shopee feature image for a compact mini desk vacuum. Product visible with factual callouts only: dry desktop crumbs, keyboard dust, compact size, USB details require seller review. No unsupported battery-life, safety certification, HEPA, germ-killing, wet-cleaning, or industrial claims.",
    },
  ];
  const images = [];
  for (const prompt of prompts) {
    const generated = await imageProvider.generateProductImage({
      runId: writer.runId,
      prompt: prompt.prompt,
      constraints: {
        asset_type: prompt.type,
        size: prompt.type === "lifestyle" ? "1536x1024" : "1024x1024",
        quality: "low",
        format: "jpeg",
      },
    });
    images.push(generated);
  }
  const fallbackImages = images.filter((image) => String(image.image.metadata.provider_mode ?? "").includes("fallback"));
  const seedImages = images.filter((image) => image.source.mode !== "live");
  const checkpoint = await risk.checkpoint("packaging", {
    brief,
    title: listing.shopee.item_name,
    description: listing.shopee.description,
    prompt: prompts.map((item) => item.prompt).join("\n"),
    category: brief.category,
  });
  const blockers = [
    ...fallbackImages.map((image) => `Image fallback: ${image.image.type}`),
    ...seedImages.map((image) => `Non-live image source: ${image.image.type}`),
    ...(checkpoint.hard_block ? checkpoint.warnings : []),
  ];

  await writer.write(
    "packaging",
    blockers.length ? "blocked" : "passed",
    {
      competitor_source: market.source,
      prompts,
      images: images.map((image) => ({
        source: image.source,
        image: image.image,
        warnings: image.warnings,
      })),
      checkpoint,
    },
    `OpenAI image generation attempted for ${images.length} assets.`,
    blockers,
  );
  return blockers.length === 0;
}

async function writeBlockedPackaging(writer: StageWriter): Promise<false> {
  await writer.write(
    "packaging",
    "blocked",
    {},
    "Packaging skipped because Listing handoff was not available.",
    ["Packaging requires selected_listing from listing stage."],
  );
  return false;
}

async function runPackagingImageSmokeStage(
  brief: Brief,
  market: BrowserShopeeSearchResult,
  writer: StageWriter,
  risk: ReturnType<typeof createRiskSupervisor>,
): Promise<boolean> {
  const title = market.products[0]?.title || "Mini Desk Vacuum";
  const imageProvider = createOpenAIImageProvider({
    mode: "live",
    model: process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-2",
    outputRoot: join(writer.auditDir, "generated-images"),
    publicBasePath: `/generated-live/${writer.runId}`,
  });
  const prompts = [
    {
      type: "hero" as const,
      prompt: `Shopee Singapore ecommerce hero image for ${title}. Show one compact desk vacuum product on a clean white background. Use only visible market evidence: mini desk vacuum, desk/keyboard dry dust context, compact tabletop accessory. No text, no logo, no badge, no certification mark, no exaggerated suction effect.`,
    },
    {
      type: "lifestyle" as const,
      prompt: `Realistic Singapore HDB home office desk lifestyle image for ${title}. Show practical use near a keyboard with light dry crumbs only. No wet mess, heavy debris, floor cleaning, car cleaning, children, dramatic airflow, or certification badge.`,
    },
    {
      type: "feature" as const,
      prompt: `Simple Shopee feature image for ${title}. Factual callouts only: dry desktop crumbs, keyboard dust, compact desk use. No unsupported battery-life, safety certification, HEPA, germ-killing, wet-cleaning, or industrial claims.`,
    },
  ];
  const images = [];
  for (const prompt of prompts) {
    images.push(
      await imageProvider.generateProductImage({
        runId: writer.runId,
        prompt: prompt.prompt,
        constraints: {
          asset_type: prompt.type,
          size: prompt.type === "lifestyle" ? "1536x1024" : "1024x1024",
          quality: "low",
          format: "jpeg",
        },
      }),
    );
  }
  const checkpoint = await risk.checkpoint("packaging", {
    brief,
    title,
    prompt: prompts.map((item) => item.prompt).join("\n"),
    category: brief.category,
  });
  const fallbackImages = images.filter((image) => String(image.image.metadata.provider_mode ?? "").includes("fallback"));
  const blockers = [
    "Full Packaging Agent handoff blocked because selected_listing is unavailable.",
    ...fallbackImages.map((image) => `Image fallback: ${image.image.type}`),
    ...(checkpoint.hard_block ? checkpoint.warnings : []),
  ];
  await writer.write(
    "packaging",
    fallbackImages.length || checkpoint.hard_block ? "blocked" : "partial",
    {
      mode: "image_provider_smoke",
      product_code: PRODUCT_CODE,
      market_source: market.source,
      prompts,
      images: images.map((image) => ({ source: image.source, image: image.image, warnings: image.warnings })),
      checkpoint,
    },
    "OpenAI image provider live smoke ran without a complete listing handoff.",
    blockers,
  );
  return fallbackImages.length === 0 && !checkpoint.hard_block;
}

function createFrankfurterFxProvider(): FxProvider {
  return {
    async convert(input: FxConvertInput): Promise<FxConvertResult> {
      const sourceUrl = `https://api.frankfurter.dev/v2/rate/${encodeURIComponent(input.from)}/${encodeURIComponent(input.to)}`;
      const response = await fetch(sourceUrl);
      const body = (await response.json()) as { rate?: number; message?: string };
      if (!response.ok || typeof body.rate !== "number") {
        throw new Error(`Frankfurter failed: ${response.status} ${body.message ?? "missing rate"}`);
      }
      return {
        source: {
          provider: "frankfurter",
          mode: "live",
          source_url: sourceUrl,
          captured_at: nowIso(),
        },
        amount: input.amount,
        from: input.from,
        to: input.to,
        rate: body.rate,
        converted_amount: roundMoney(input.amount * body.rate),
      };
    },
  };
}

interface ProductSpecs {
  weight_g: number;
  dimensions_cm: { length: number; width: number; height: number };
}

function deriveRealProductSpecs(selectedOffer: Browser1688OfferDetail | undefined): ProductSpecs | undefined {
  if (selectedOffer?.package_weight_g && selectedOffer.package_dimensions_cm.length > 0) {
    return {
      weight_g: selectedOffer.package_weight_g,
      dimensions_cm: selectedOffer.package_dimensions_cm,
    };
  }
  const weight = Number(process.env.LIVE_PRODUCT_WEIGHT_G);
  const length = Number(process.env.LIVE_PRODUCT_LENGTH_CM);
  const width = Number(process.env.LIVE_PRODUCT_WIDTH_CM);
  const height = Number(process.env.LIVE_PRODUCT_HEIGHT_CM);
  if ([weight, length, width, height].every((value) => Number.isFinite(value) && value > 0)) {
    return { weight_g: weight, dimensions_cm: { length, width, height } };
  }
  // Search result rows do not currently expose package specs. Keep this strict:
  // without a real detail-page parser or supplier/user-provided spec, shipping
  // and margin must block instead of borrowing seed dimensions.
  return undefined;
}

function comparableSpecBlockers(detail: Browser1688OfferDetail, market: BrowserShopeeSearchResult): string[] {
  const text = `${detail.title} ${detail.evidence_label}`.toLowerCase();
  const marketText = market.products.map((product) => product.title).join(" ").toLowerCase();
  const requiredProductMatch =
    /吸尘|清洁|桌面|键盘|vacuum|cleaner|desktop|desk|keyboard/.test(text) &&
    /vacuum|cleaner|desktop|desk|keyboard/i.test(marketText);
  const dims = detail.package_dimensions_cm;
  return [
    requiredProductMatch ? "" : "Source detail title does not look comparable to Shopee mini desk vacuum results.",
    detail.package_weight_g >= 50 && detail.package_weight_g <= 2_000
      ? ""
      : `Package weight ${detail.package_weight_g}g is outside mini desk-vacuum comparison range.`,
    dims.length > 0 && dims.width > 0 && dims.height > 0 && Math.max(dims.length, dims.width, dims.height) <= 50
      ? ""
      : `Package dimensions ${dims.length}x${dims.width}x${dims.height}cm are missing or outside comparison range.`,
    detail.available_stock > 0 ? "" : "Stock signal is missing or zero on detail page.",
    detail.supplier_name && !/^Unknown/.test(detail.supplier_name) ? "" : "Supplier/shop name is missing on detail page.",
  ].filter(Boolean);
}

function isTaobaoUrl(url: string): boolean {
  try {
    const hostname = new URL(url).hostname;
    return /(^|\.)taobao\.com$|(^|\.)tmall\.com$/.test(hostname);
  } catch {
    return false;
  }
}


function selectBestVisibleOffer(search: Browser1688SearchResult | BrowserTaobaoSearchResult): Browser1688SearchResult["offers"][number] | undefined {
  return [...search.offers].sort((left, right) => left.source_price_cny - right.source_price_cny)[0];
}

function createBrowserProvider(runId: string): BrowserRetrievalProvider {
  const controller = createCdpChromeBrowserController({
    endpoint: CHROME_ENDPOINT,
    screenshotDir: join(SCREENSHOT_ROOT, runId),
    navigationTimeoutMs: Number(process.env.LIVE_BROWSER_NAVIGATION_TIMEOUT_MS ?? 15_000),
    settleMs: Number(process.env.LIVE_BROWSER_SETTLE_MS ?? 1_000),
  });
  return createChromeBrowserRetrievalProvider(controller, {
    allowedDomains: ["shopee.sg", "seller.shopee.sg", "ads.shopee.sg", "1688.com", "taobao.com", "tmall.com", "google.com"],
    maxSteps: 3,
  });
}

function buildBrief(): Brief {
  return {
    target_market: TARGET_MARKET,
    target_platform: TARGET_PLATFORM,
    seller_type: "individual dropshipper",
    product_intent: PRODUCT_QUERY_EN,
    category: "home_appliances_small",
    budget: 300,
    target_margin: 0.3,
    max_fulfillment_days: 14,
    risk_appetite: "balanced",
    language: "en",
  };
}

function buildAssumptions(sourcePriceCny: number, fxRate: number, shippingCostSgd: number, multiplier = 1): MarginAssumptions {
  return {
    source_price_cny: sourcePriceCny,
    fx_cny_sgd: fxRate,
    intl_shipping_sgd: shippingCostSgd,
    local_delivery_sgd: roundMoney(0.8 * multiplier),
    packaging_sgd: roundMoney(0.35 * multiplier),
    ai_ops_sgd: roundMoney(0.12 * multiplier),
    platform_fee_rate: 0.08,
    payment_fee_rate: 0.025,
    return_reserve_rate: 0.04 * multiplier,
    damage_reserve_rate: 0.015 * multiplier,
    import_gst_rate: 0.09,
  };
}

async function createStageWriter(runId: string): Promise<StageWriter> {
  const auditDir = join(AUDIT_ROOT, runId);
  await mkdir(auditDir, { recursive: true });
  const stages: StageRecord[] = [];

  return {
    runId,
    auditDir,
    stages,
    async write(name, status, data, summary, blockers = []) {
      const safeName = name.replace(/[^a-z0-9_.-]+/gi, "_");
      const outputPath = join(auditDir, `${safeName}.json`);
      await writeFile(outputPath, `${JSON.stringify({ name, status, summary, blockers, data }, null, 2)}\n`, "utf8");
      stages.push({ name, status, output_path: outputPath, summary, blockers });
    },
  };
}

async function writeSummary(writer: StageWriter, data: Record<string, unknown>): Promise<{ stage_counts: Record<StageStatus, number> }> {
  const stageCounts: Record<StageStatus, number> = { passed: 0, partial: 0, blocked: 0, failed: 0 };
  for (const stage of writer.stages) {
    stageCounts[stage.status] += 1;
  }
  const summary = {
    ...data,
    stage_counts: stageCounts,
    stages: writer.stages,
    generated_at: nowIso(),
  };
  await writeFile(join(writer.auditDir, "precommittee.summary.json"), `${JSON.stringify(summary, null, 2)}\n`, "utf8");
  return { stage_counts: stageCounts };
}

function preflightStatus(): StageStatus {
  return preflightBlockers().length ? "blocked" : "passed";
}

function preflightBlockers(): string[] {
  return [
    process.env.OPENAI_API_KEY ? "" : "OPENAI_API_KEY missing.",
    process.env.LOGISTICS_PROVIDER === "easyship" && !process.env.EASYSHIP_API_KEY ? "EASYSHIP_API_KEY missing." : "",
    process.env.LOGISTICS_PROVIDER !== "easyship" ? "LOGISTICS_PROVIDER must be easyship for live shipping rates." : "",
    process.env.DEMO_MOCK_ONLY === "true" ? "DEMO_MOCK_ONLY=true; live test requires disabling mock-only mode." : "",
  ].filter(Boolean);
}

function expectNoSeedStages(stages: StageRecord[]): void {
  const serialized = JSON.stringify(stages);
  expect(serialized).not.toMatch(/"mode":"seed"|"fixture_id"/);
}

function statusOf(writer: StageWriter, name: string): StageStatus | undefined {
  return writer.stages.find((stage) => stage.name === name)?.status;
}

function assertBrowserSource(source: ProviderSource, label: string): void {
  if (source.mode !== "browser") {
    throw new Error(`${label} used non-browser source mode: ${source.mode}`);
  }
  if (!source.raw_snapshot_id || !source.extracted_text_hash) {
    throw new Error(`${label} missing browser snapshot audit metadata.`);
  }
}

function assertLiveSource(source: ProviderSource, label: string): void {
  if (source.mode !== "live") {
    throw new Error(`${label} used non-live source mode: ${source.mode}`);
  }
}

function demandScore(search: BrowserShopeeSearchResult): number {
  const ratingAverage = search.products.length
    ? search.products.reduce((sum, product) => sum + product.rating, 0) / search.products.length
    : 0;
  return Math.max(0, Math.min(100, Math.round(42 + search.competitor_count * 4 + ratingAverage * 6)));
}

function settledValue<T>(result: PromiseSettledResult<T>): unknown {
  return result.status === "fulfilled" ? result.value : { error: errorMessage(result.reason) };
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function roundMoney(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function loadEnvLocal(): void {
  try {
    const raw = readFileSync(join(process.cwd(), ".env.local"), "utf8");
    const parsed = new Map<string, string>();
    for (const line of raw.split(/\n+/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (!match) {
        continue;
      }
      parsed.set(match[1], match[2].replace(/^['"]|['"]$/g, ""));
    }
    for (const [key, value] of parsed) {
      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Tests report missing env values in preflight; no need to fail at import time.
  }
}
