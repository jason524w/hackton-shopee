import { createHash } from "node:crypto";
import { includesQuery, nowIso, readSeedJson, roundMoney } from "../shared";
import type {
  Browser1688OfferDetail,
  Browser1688OfferInput,
  Browser1688OfferResult,
  Browser1688SearchInput,
  Browser1688SearchResult,
  BrowserController,
  BrowserControllerSnapshot,
  BrowserOfferStockInput,
  BrowserOfferStockResult,
  BrowserRetrievalPolicy,
  BrowserRetrievalProvider,
  BrowserRetrievalPurpose,
  BrowserRetrievePageSnapshotInput,
  BrowserRetrievePageSnapshotResult,
  Browser1688OfferSignal,
  BrowserShopeeAdsSignalsInput,
  BrowserShopeeAdsSignalsResult,
  BrowserShopeeProductSignal,
  BrowserShopeeSearchInput,
  BrowserShopeeSearchResult,
  BrowserSnapshotEvidence,
  BrowserSupplierSignalsInput,
  BrowserSupplierSignalsResult,
  BrowserSupplierStability,
  BrowserTaobaoSearchInput,
  BrowserTaobaoSearchResult,
  BrowserUnavailableResult,
  BrowserWebTrendInput,
  BrowserWebTrendResult,
} from "./types";

interface ShopeeSearchSeed {
  fixture_id: string;
  captured_at: string;
  source_url: string;
  market: string;
  category: string;
  products: Array<{
    item_id: string;
    title: string;
    price_sgd: number;
    rating: number;
    review_count: number;
    sold_label?: string;
    shop_type?: "mall" | "preferred" | "marketplace";
    image_url?: string;
    product_url?: string;
    category_id?: number;
    evidence_label: string;
  }>;
}

interface SourcingSeed {
  fixture_id: string;
  captured_at: string;
  offers: Array<{
    offer_id: string;
    title: string;
    source_price_cny: number;
    currency: "CNY";
    moq: number;
    available_stock: number;
    supplier_name: string;
    supplier_location: string;
    domestic_dispatch_days: number;
    source_url?: string;
    evidence_label: string;
    sku_options: Array<{ name: string; options: string[] }>;
    package_weight_g: number;
    package_dimensions_cm: { length: number; width: number; height: number };
    supplier_risk_notes: string[];
  }>;
}

export interface ChromeBrowserRetrievalOptions {
  allowedDomains?: string[];
  maxSteps?: number;
}

const DEFAULT_ALLOWED_DOMAINS = [
  "shopee.sg",
  "seller.shopee.sg",
  "ads.shopee.sg",
  "1688.com",
  "detail.1688.com",
  "s.1688.com",
  "taobao.com",
  "s.taobao.com",
  "tmall.com",
  "detail.tmall.com",
  "google.com",
  "www.google.com",
];

export function createSeedBrowserRetrievalProvider(): BrowserRetrievalProvider {
  return {
    async retrievePageSnapshot(input: BrowserRetrievePageSnapshotInput): Promise<BrowserRetrievePageSnapshotResult> {
      const policy = resolvePolicy(input.purpose, input.policy);
      assertAllowedUrl(input.url, policy);
      const capturedAt = nowIso();
      const text = `Seed browser snapshot for ${input.purpose}: ${input.url}`;
      const snapshot = createSnapshot({
        url: input.url,
        capturedAt,
        text,
        method: "seed",
        confidence: 0.6,
        selectorNotes: ["seed snapshot; no live browser navigation"],
        warnings: ["Seed browser provider did not open Chrome."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, input.url, snapshot),
        url: input.url,
        title: `Seed snapshot: ${input.purpose}`,
        text_excerpt: text,
        links: [],
        snapshot,
        warnings: [
          {
            code: "BROWSER_SEED_MODE",
            severity: "info",
            message: "Browser retrieval is using seed-backed snapshots.",
          },
        ],
      };
    },

    async extractShopeeSearch(input: BrowserShopeeSearchInput): Promise<BrowserShopeeSearchResult> {
      const seed = await readSeedJson<ShopeeSearchSeed>("seed/shopee/mini-desk-vacuum-search.json");
      const policy = resolvePolicy("market_shopee_search", input.policy);
      assertAllowedUrl(seed.source_url, policy);
      const matched = seed.products.filter((product) => includesQuery(product.title, input.query));
      const products = (matched.length ? matched : seed.products).slice(0, input.limit ?? seed.products.length);
      const prices = products.map((product) => product.price_sgd).sort((a, b) => a - b);
      const capturedAt = seed.captured_at;
      const snapshot = createSnapshot({
        url: seed.source_url,
        capturedAt,
        text: products.map((product) => `${product.title} ${product.price_sgd} ${product.review_count}`).join("\n"),
        method: "seed",
        confidence: 0.72,
        selectorNotes: ["seed/shopee/mini-desk-vacuum-search.json"],
        warnings: ["Seed snapshot represents pre-captured Shopee SG search evidence."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, seed.source_url, snapshot, seed.fixture_id),
        query: input.query,
        market: input.market,
        category: input.category ?? seed.category,
        products,
        competitor_count: products.length,
        price_band: {
          low: prices[0] ?? 0,
          high: prices[prices.length - 1] ?? 0,
          median: roundMoney(prices.length ? prices[Math.floor(prices.length / 2)] : 0),
        },
        snapshot,
      };
    },

    async extractShopeeAdsSignals(input: BrowserShopeeAdsSignalsInput): Promise<BrowserShopeeAdsSignalsResult> {
      const capturedAt = nowIso();
      const snapshot = createSnapshot({
        url: "https://seller.shopee.sg/",
        capturedAt,
        text: `Shopee Ads signals unavailable in seed mode for ${input.market}`,
        method: "seed",
        confidence: 0.2,
        selectorNotes: ["seller centre access not included in seed data"],
        warnings: ["Shopee Ads recommendation tags require whitelisted Seller Centre access."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, "https://seller.shopee.sg/", snapshot),
        market: input.market,
        available: false,
        requires_human_login: true,
        signals: [],
        snapshot,
        warnings: [
          {
            code: "SELLER_CENTRE_LOGIN_REQUIRED",
            severity: "warning",
            message: "Best Selling / Good ROAS / Top Searched tags require a logged-in whitelisted Seller Centre session.",
          },
        ],
      };
    },

    async extractWebTrend(input: BrowserWebTrendInput): Promise<BrowserWebTrendResult> {
      const capturedAt = nowIso();
      const snapshot = createSnapshot({
        url: `https://www.google.com/search?q=${encodeURIComponent(`${input.query} ${input.market} Shopee`)}`,
        capturedAt,
        text: `No live web trend search was performed for ${input.query}.`,
        method: "seed",
        confidence: 0.25,
        selectorNotes: ["web trend live browser search disabled in seed mode"],
        warnings: ["No live web trend page was opened."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, snapshot.url, snapshot),
        query: input.query,
        market: input.market,
        articles: [],
        trend_keywords: [],
        snapshot,
        warnings: [
          {
            code: "WEB_TREND_SEED_EMPTY",
            severity: "info",
            message: "Seed mode returns no web trend articles; enable Chrome mode for live web trend snapshots.",
          },
        ],
      };
    },

    async extract1688Search(input: Browser1688SearchInput): Promise<Browser1688SearchResult> {
      const seed = await readSeedJson<SourcingSeed>("seed/sourcing-1688/mini-desk-vacuum-offers.json");
      const matched = seed.offers.filter((offer) => includesQuery(offer.title, input.query));
      const offers = (matched.length ? matched : seed.offers).slice(0, input.limit ?? seed.offers.length);
      const capturedAt = seed.captured_at;
      const snapshot = createSnapshot({
        url: offers[0]?.source_url ?? "https://www.1688.com/",
        capturedAt,
        text: offers.map((offer) => `${offer.title} ${offer.source_price_cny} ${offer.available_stock}`).join("\n"),
        method: "seed",
        confidence: 0.74,
        selectorNotes: ["seed/sourcing-1688/mini-desk-vacuum-offers.json"],
        warnings: ["Seed snapshot represents pre-captured 1688 offer evidence."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, snapshot.url, snapshot, seed.fixture_id),
        query: input.query,
        offers: offers.map((offer) => ({
          offer_id: offer.offer_id,
          title: offer.title,
          source_price_cny: offer.source_price_cny,
          currency: offer.currency,
          moq: offer.moq,
          available_stock: offer.available_stock,
          supplier_name: offer.supplier_name,
          supplier_location: offer.supplier_location,
          domestic_dispatch_days: offer.domestic_dispatch_days,
          source_url: offer.source_url,
          evidence_label: offer.evidence_label,
        })),
        snapshot,
      };
    },

    async extractTaobaoSearch(input: BrowserTaobaoSearchInput): Promise<BrowserTaobaoSearchResult> {
      const capturedAt = nowIso();
      const snapshot = createSnapshot({
        url: "https://s.taobao.com/search",
        capturedAt,
        text: `No seed Taobao search was performed for ${input.query}.`,
        method: "seed",
        confidence: 0.2,
        selectorNotes: ["taobao live browser search disabled in seed mode"],
        warnings: ["Seed mode does not fabricate Taobao sourcing rows."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, snapshot.url, snapshot),
        query: input.query,
        offers: [],
        snapshot,
        warnings: [
          {
            code: "TAOBAO_SEED_EMPTY",
            severity: "info",
            message: "Seed mode returns no Taobao rows; use an authorized Chrome session for real Taobao sourcing.",
          },
        ],
      };
    },

    async extract1688Offer(input: Browser1688OfferInput): Promise<Browser1688OfferResult> {
      const seed = await readSeedJson<SourcingSeed>("seed/sourcing-1688/mini-desk-vacuum-offers.json");
      const offer = findOffer(seed, input);
      const capturedAt = seed.captured_at;
      const detail = toBrowserOfferDetail(offer, capturedAt);
      const snapshot = createSnapshot({
        url: offer.source_url ?? "https://www.1688.com/",
        capturedAt,
        text: JSON.stringify(detail),
        method: "seed",
        confidence: 0.76,
        selectorNotes: ["seed/sourcing-1688/mini-desk-vacuum-offers.json"],
        warnings: ["Supplier stability fields are deterministic seed-derived estimates, not live platform guarantees."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, snapshot.url, snapshot, seed.fixture_id),
        offer: detail,
        snapshot,
      };
    },

    async refreshOfferStock(input: BrowserOfferStockInput): Promise<BrowserOfferStockResult> {
      const seed = await readSeedJson<SourcingSeed>("seed/sourcing-1688/mini-desk-vacuum-offers.json");
      const offer = findOffer(seed, { offerId: input.offerId });
      const capturedAt = seed.captured_at;
      const snapshot = createSnapshot({
        url: offer.source_url ?? "https://www.1688.com/",
        capturedAt,
        text: `${offer.offer_id} stock ${offer.available_stock}`,
        method: "seed",
        confidence: 0.72,
        selectorNotes: ["seed stock field"],
        warnings: ["Stock refresh is seed-backed; live Chrome mode is required for current stock."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, snapshot.url, snapshot, seed.fixture_id),
        offer_id: offer.offer_id,
        available_stock: offer.available_stock,
        last_seen_at: capturedAt,
        snapshot,
      };
    },

    async extractSupplierSignals(input: BrowserSupplierSignalsInput): Promise<BrowserSupplierSignalsResult> {
      const seed = await readSeedJson<SourcingSeed>("seed/sourcing-1688/mini-desk-vacuum-offers.json");
      const offer = input.offerId
        ? findOffer(seed, { offerId: input.offerId })
        : seed.offers.find((candidate) => candidate.supplier_name === input.supplierName) ?? seed.offers[0];
      if (!offer) {
        throw new Error("No supplier signal seed available.");
      }
      const capturedAt = seed.captured_at;
      const supplier = buildSupplierStability(offer);
      const snapshot = createSnapshot({
        url: offer.source_url ?? "https://www.1688.com/",
        capturedAt,
        text: JSON.stringify(supplier),
        method: "seed",
        confidence: 0.66,
        selectorNotes: ["derived from offer stock, MOQ, location, and supplier risk notes"],
        warnings: ["Supplier stability is a seed-derived heuristic until live supplier profile extraction is enabled."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, snapshot.url, snapshot, seed.fixture_id),
        supplier,
        snapshot,
      };
    },
  };
}

export function createChromeBrowserRetrievalProvider(
  controller: BrowserController,
  options: ChromeBrowserRetrievalOptions = {},
): BrowserRetrievalProvider {
  const allowedDomains = options.allowedDomains ?? DEFAULT_ALLOWED_DOMAINS;
  const maxSteps = options.maxSteps ?? 3;

  return {
    async retrievePageSnapshot(input: BrowserRetrievePageSnapshotInput): Promise<BrowserRetrievePageSnapshotResult> {
      const policy = resolvePolicy(input.purpose, {
        allowed_domains: allowedDomains,
        max_steps: maxSteps,
        ...input.policy,
      });
      assertAllowedUrl(input.url, policy);
      const captured = await controller.capture({ url: input.url, purpose: input.purpose, policy });
      return toPageSnapshot(input.url, input.purpose, captured);
    },

    async extractShopeeSearch(input: BrowserShopeeSearchInput): Promise<BrowserShopeeSearchResult> {
      const url = `https://shopee.sg/search?keyword=${encodeURIComponent(input.query)}`;
      const page = await this.retrievePageSnapshot({ url, purpose: "market_shopee_search", policy: input.policy });
      const products = parseShopeeProducts(page.text_excerpt, input.limit ?? 20);
      const prices = products.map((product) => product.price_sgd).sort((a, b) => a - b);
      return {
        source: page.source,
        query: input.query,
        market: input.market,
        category: input.category,
        products,
        competitor_count: products.length,
        price_band: {
          low: prices[0] ?? 0,
          high: prices[prices.length - 1] ?? 0,
          median: roundMoney(prices.length ? prices[Math.floor(prices.length / 2)] : 0),
        },
        snapshot: page.snapshot,
        warnings:
          products.length === 0
            ? [
                {
                  code: "CHROME_SHOPEE_PRODUCTS_NOT_FOUND",
                  severity: "warning",
                  message: "Chrome captured a Shopee page, but no visible product rows were parsed.",
                },
              ]
            : undefined,
      };
    },

    async extractShopeeAdsSignals(input: BrowserShopeeAdsSignalsInput): Promise<BrowserShopeeAdsSignalsResult> {
      const page = await this.retrievePageSnapshot({
        url: "https://seller.shopee.sg/portal/marketing/pas",
        purpose: "market_shopee_ads",
        policy: { requires_human_login: true, ...input.policy },
      });
      return {
        source: page.source,
        market: input.market,
        available: false,
        requires_human_login: true,
        signals: [],
        snapshot: page.snapshot,
        warnings: [
          {
            code: "SELLER_CENTRE_PARSE_PENDING",
            severity: "warning",
            message: "Chrome captured Seller Centre page evidence; Ads recommendation tag parser is pending.",
          },
        ],
      };
    },

    async extractWebTrend(input: BrowserWebTrendInput): Promise<BrowserWebTrendResult> {
      const url = `https://www.google.com/search?q=${encodeURIComponent(`${input.query} ${input.market} shopping trend`)}`;
      const page = await this.retrievePageSnapshot({ url, purpose: "market_web_trend", policy: input.policy });
      return {
        source: page.source,
        query: input.query,
        market: input.market,
        articles: page.links.slice(0, input.limit ?? 5).map((link) => ({
          title: link.label,
          url: link.url,
          source_label: hostname(link.url),
          trend_keywords: keywordHints(page.text_excerpt),
          evidence_label: `Chrome snapshot link: ${link.label}`,
        })),
        trend_keywords: keywordHints(page.text_excerpt),
        snapshot: page.snapshot,
      };
    },

    async extract1688Search(input: Browser1688SearchInput): Promise<Browser1688SearchResult> {
      const url = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encode1688Keyword(input.query)}`;
      const page = await this.retrievePageSnapshot({ url, purpose: "sourcing_1688_search", policy: input.policy });
      assertNoAccessChallenge(page.text_excerpt, page.url);
      const offers = parse1688Offers(page.text_excerpt, input.limit ?? 20);
      if (offers.length === 0) {
        throw new Error(
          `No visible 1688 offer rows were parsed for ${page.url}. Human login/refresh or parser update is required; seed/mock data was not used.`,
        );
      }
      return {
        source: page.source,
        query: input.query,
        offers,
        snapshot: page.snapshot,
      };
    },

    async extractTaobaoSearch(input: BrowserTaobaoSearchInput): Promise<BrowserTaobaoSearchResult> {
      const url = `https://s.taobao.com/search?q=${encodeURIComponent(input.query)}`;
      const page = await this.retrievePageSnapshot({ url, purpose: "sourcing_taobao_search", policy: input.policy });
      assertNoAccessChallenge(page.text_excerpt, page.url);
      const offers = parseTaobaoOffers(page.text_excerpt, input.limit ?? 20);
      if (offers.length === 0) {
        throw new Error(
          `No visible Taobao product rows were parsed for ${page.url}. Human login/refresh or parser update is required; seed/mock data was not used.`,
        );
      }
      return {
        source: page.source,
        query: input.query,
        offers,
        snapshot: page.snapshot,
      };
    },

    async extract1688Offer(input: Browser1688OfferInput): Promise<Browser1688OfferResult | BrowserUnavailableResult> {
      if (!input.url) {
        return unavailableBrowserResult({
          url: "https://www.1688.com/",
          code: "CHROME_1688_OFFER_URL_REQUIRED",
          message: "Chrome 1688 offer extraction requires an offer URL; no browser page was opened.",
          requiresHumanInput: true,
        });
      }
      const page = await this.retrievePageSnapshot({ url: input.url, purpose: "sourcing_1688_offer", policy: input.policy });
      assertNoAccessChallenge(page.text_excerpt, page.url);
      return unavailableBrowserResult({
        page,
        code: "CHROME_1688_OFFER_PARSER_PENDING",
        message: `Chrome captured the 1688 offer page, but detailed offer parsing is pending for snapshot ${page.snapshot.snapshot_id}.`,
        requiresHumanInput: false,
      });
    },

    async refreshOfferStock(input: BrowserOfferStockInput): Promise<BrowserOfferStockResult | BrowserUnavailableResult> {
      return unavailableBrowserResult({
        url: "https://www.1688.com/",
        code: "CHROME_STOCK_REFRESH_URL_REQUIRED",
        message: `Chrome stock refresh requires an offer URL mapping for offer ${input.offerId}; no browser page was opened.`,
        requiresHumanInput: true,
      });
    },

    async extractSupplierSignals(input: BrowserSupplierSignalsInput): Promise<BrowserSupplierSignalsResult | BrowserUnavailableResult> {
      return unavailableBrowserResult({
        url: "https://www.1688.com/",
        code: "CHROME_SUPPLIER_PROFILE_URL_REQUIRED",
        message: `Chrome supplier extraction requires supplier page URL mapping for ${
          input.offerId ?? input.supplierName ?? "unknown supplier"
        }; no browser page was opened.`,
        requiresHumanInput: true,
      });
    },
  };
}

export const browserRetrievalProvider = createSeedBrowserRetrievalProvider();
export { createCdpChromeBrowserController } from "./chrome";
export type * from "./types";

function toPageSnapshot(
  fallbackUrl: string,
  purpose: BrowserRetrievalPurpose,
  captured: BrowserControllerSnapshot,
): BrowserRetrievePageSnapshotResult {
  const capturedAt = captured.captured_at ?? nowIso();
  const url = captured.url || fallbackUrl;
  const snapshot = createSnapshot({
    url,
    capturedAt,
    text: captured.text,
    method: "chrome",
    screenshotPath: captured.screenshot_path,
    confidence: 0.7,
    selectorNotes: [`chrome controller snapshot for ${purpose}`],
    warnings: [],
  });

  return {
    source: source("browser-retrieval", "browser", capturedAt, url, snapshot),
    url,
    title: captured.title,
    text_excerpt: truncate(captured.text, 25_000),
    links: captured.links ?? [],
    snapshot,
  };
}

function unavailableBrowserResult(input: {
  page?: BrowserRetrievePageSnapshotResult;
  url?: string;
  code: string;
  message: string;
  requiresHumanInput: boolean;
}): BrowserUnavailableResult {
  const capturedAt = input.page?.snapshot.captured_at ?? nowIso();
  const url = input.page?.url ?? input.url ?? "https://www.1688.com/";
  const snapshot =
    input.page?.snapshot ??
    createSnapshot({
      url,
      capturedAt,
      text: input.message,
      method: "manual_snapshot",
      confidence: 0,
      selectorNotes: ["no browser page captured for unavailable browser tool"],
      warnings: [input.message],
    });

  return {
    source: input.page?.source ?? source("browser-retrieval", "snapshot", capturedAt, url, snapshot),
    available: false,
    reason: input.message,
    requires_human_input: input.requiresHumanInput,
    snapshot,
    warnings: [
      {
        code: input.code,
        severity: "warning",
        message: input.message,
      },
    ],
  };
}

function resolvePolicy(
  purpose: BrowserRetrievalPurpose,
  override: Partial<BrowserRetrievalPolicy> = {},
): BrowserRetrievalPolicy {
  const requiresHumanLogin = purpose === "market_shopee_ads";
  return {
    allowed_domains: DEFAULT_ALLOWED_DOMAINS,
    max_steps: 3,
    requires_human_login: requiresHumanLogin,
    capture_screenshot: true,
    redact_sensitive: true,
    ...override,
  };
}

function assertAllowedUrl(url: string, policy: BrowserRetrievalPolicy): void {
  const target = new URL(url);
  const allowed = policy.allowed_domains.some(
    (domain) => target.hostname === domain || target.hostname.endsWith(`.${domain}`),
  );
  if (!allowed) {
    throw new Error(`Browser retrieval blocked for ${target.hostname}; allowed domains: ${policy.allowed_domains.join(", ")}`);
  }
  if (policy.max_steps < 1) {
    throw new Error("Browser retrieval max_steps must be at least 1.");
  }
}

function createSnapshot(input: {
  url: string;
  capturedAt: string;
  text: string;
  method: BrowserSnapshotEvidence["extraction_method"];
  confidence: number;
  selectorNotes: string[];
  warnings: string[];
  screenshotPath?: string;
}): BrowserSnapshotEvidence {
  const hash = hashText(input.text);
  return {
    snapshot_id: `browser_${input.method}_${hash.slice(0, 12)}`,
    url: input.url,
    captured_at: input.capturedAt,
    extraction_method: input.method,
    extracted_text_hash: hash,
    screenshot_path: input.screenshotPath,
    selector_notes: input.selectorNotes,
    confidence: input.confidence,
    warnings: input.warnings,
  };
}

function source(
  provider: string,
  mode: "seed" | "browser" | "snapshot" | "live",
  capturedAt: string,
  sourceUrl: string,
  snapshot: BrowserSnapshotEvidence,
  fixtureId?: string,
) {
  return {
    provider,
    mode,
    fixture_id: fixtureId,
    raw_snapshot_id: snapshot.snapshot_id,
    source_url: sourceUrl,
    screenshot_path: snapshot.screenshot_path,
    extracted_text_hash: snapshot.extracted_text_hash,
    captured_at: capturedAt,
  };
}

function findOffer(seed: SourcingSeed, input: Browser1688OfferInput): SourcingSeed["offers"][number] {
  const offer = seed.offers.find(
    (candidate) =>
      (input.offerId && candidate.offer_id === input.offerId) ||
      (input.url && candidate.source_url && candidate.source_url === input.url),
  );
  if (!offer) {
    throw new Error(`1688 offer not found for ${input.offerId ?? input.url ?? "unknown input"}`);
  }
  return offer;
}

function toBrowserOfferDetail(offer: SourcingSeed["offers"][number], capturedAt: string): Browser1688OfferDetail {
  return {
    ...offer,
    price_ladder: [
      { min_qty: offer.moq, unit_price_cny: offer.source_price_cny },
      { min_qty: Math.max(offer.moq * 10, offer.moq + 10), unit_price_cny: roundMoney(offer.source_price_cny * 0.94) },
    ],
    supplier_stability: buildSupplierStability(offer),
    last_seen_stock: offer.available_stock,
    last_seen_at: capturedAt,
    negotiation_notes: [
      "Confirm current stock before committing test order.",
      "Ask supplier to verify packed weight and dimensions for Shippo shipping estimate.",
      "Ask whether USB electrical safety notes or documentation are available.",
    ],
  };
}

function buildSupplierStability(offer: SourcingSeed["offers"][number]): BrowserSupplierStability {
  const stockScore = offer.available_stock >= 1_000 ? 24 : offer.available_stock >= 300 ? 18 : 10;
  const moqScore = offer.moq <= 5 ? 18 : offer.moq <= 20 ? 12 : 6;
  const riskPenalty = offer.supplier_risk_notes.length * 6;
  return {
    supplier_name: offer.supplier_name,
    supplier_location: offer.supplier_location,
    stability_score: clamp(42 + stockScore + moqScore - riskPenalty, 0, 100),
    dispute_or_risk_notes: offer.supplier_risk_notes,
  };
}

function parseShopeeProducts(text: string, limit: number): BrowserShopeeProductSignal[] {
  const lines = visibleLines(text);
  const start = Math.max(
    0,
    lines.findIndex((line) => /search result/i.test(line)),
  );
  const products: BrowserShopeeProductSignal[] = [];

  for (let index = start; index < lines.length && products.length < limit; index += 1) {
    const title = lines[index];
    if (!looksLikeShopeeProductTitle(title)) {
      continue;
    }

    const priceIndex = findNextPriceIndex(lines, index + 1, 5);
    if (priceIndex < 0) {
      continue;
    }

    const price = parsePrice(lines[priceIndex]);
    if (price <= 0) {
      continue;
    }

    const rating = findNextRating(lines, priceIndex + 1, 8);
    const shopType = /mall/i.test(lines.slice(Math.max(0, index - 3), index + 8).join(" "))
      ? "mall"
      : /preferred/i.test(lines.slice(Math.max(0, index - 3), index + 8).join(" "))
        ? "preferred"
        : "marketplace";

    products.push({
      item_id: `live_shopee_${hashText(`${title}:${price}`).slice(0, 12)}`,
      title,
      price_sgd: price,
      rating,
      review_count: 0,
      shop_type: shopType,
      evidence_label: `Chrome visible Shopee row: ${title} at SGD ${price.toFixed(2)}`,
    });

    index = priceIndex;
  }

  return products;
}

function parse1688Offers(text: string, limit: number): Browser1688OfferSignal[] {
  const lines = visibleLines(text);
  const offers: Browser1688OfferSignal[] = [];

  for (let index = 0; index < lines.length && offers.length < limit; index += 1) {
    const title = lines[index];
    if (!looksLike1688OfferTitle(title)) {
      continue;
    }

    const priceIndex = findNextCnyPriceIndex(lines, index + 1, 8);
    if (priceIndex < 0) {
      continue;
    }

    const price = parsePrice(lines[priceIndex]);
    if (price <= 0) {
      continue;
    }

    offers.push({
      offer_id: `live_1688_${hashText(`${title}:${price}`).slice(0, 12)}`,
      title,
      source_price_cny: price,
      currency: "CNY",
      moq: 1,
      available_stock: 0,
      supplier_name: "Unknown visible 1688 supplier",
      supplier_location: "Unknown",
      domestic_dispatch_days: 3,
      evidence_label: `Chrome visible 1688 row: ${title} at CNY ${price.toFixed(2)}`,
    });

    index = priceIndex;
  }

  return offers;
}

function encode1688Keyword(query: string): string {
  const trimmed = query.trim();
  // 1688 search still expects legacy GBK-encoded Chinese keywords in this route.
  // Keep this MVP mapping narrow; replace it with official API or a full encoder in the real adapter.
  const knownGbkQueries: Record<string, string> = {
    "桌面吸尘器": "%D7%C0%C3%E6%CE%FC%B3%BE%C6%F7",
    "迷你桌面吸尘器": "%C3%D4%C4%E3%D7%C0%C3%E6%CE%FC%B3%BE%C6%F7",
  };
  return knownGbkQueries[trimmed] ?? encodeURIComponent(trimmed);
}

function parseTaobaoOffers(text: string, limit: number): Browser1688OfferSignal[] {
  const lines = visibleLines(text);
  const offers: Browser1688OfferSignal[] = [];
  const seen = new Set<string>();

  for (let index = 0; index < lines.length && offers.length < limit; index += 1) {
    const title = lines[index];
    if (!looksLikeTaobaoOfferTitle(title) || seen.has(title)) {
      continue;
    }

    const yenIndex = findNextLine(lines, index + 1, 20, (line) => line === "¥" || line.includes("¥"));
    if (yenIndex < 0) {
      continue;
    }

    const price = parseTaobaoPrice(lines, yenIndex);
    if (price <= 0) {
      continue;
    }

    const paymentLine = findNextLine(lines, yenIndex + 1, 14, (line) => /人付款|人看过/.test(line));
    const locationStart = findNextLine(lines, yenIndex + 1, 18, (line) => /^[\u4e00-\u9fa5]{2,6}$/.test(line));
    const supplierName = inferTaobaoSupplier(lines, yenIndex, paymentLine, locationStart);
    const location = locationStart >= 0 ? [lines[locationStart], lines[locationStart + 1]].filter(Boolean).join(" ") : "Unknown";

    seen.add(title);
    offers.push({
      offer_id: `live_taobao_${hashText(`${title}:${price}:${supplierName}`).slice(0, 12)}`,
      title,
      source_price_cny: price,
      currency: "CNY",
      moq: 1,
      available_stock: 0,
      supplier_name: supplierName,
      supplier_location: location,
      domestic_dispatch_days: 3,
      evidence_label: `Chrome visible Taobao row: ${title} at CNY ${price.toFixed(2)}`,
    });

    index = yenIndex;
  }

  return offers;
}

function assertNoAccessChallenge(text: string, url: string): void {
  if (isAccessChallenge(text)) {
    throw new Error(
      `Browser retrieval hit an access verification page for ${url}. Human login/verification or an authorized API is required; seed/mock data was not used.`,
    );
  }
}

function isAccessChallenge(text: string): boolean {
  return /滑块|验证|captcha|robot|人机|拖动.*验证|ensure normal access/i.test(text);
}

function visibleLines(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function looksLikeShopeeProductTitle(line: string): boolean {
  if (line.length < 18 || line.length > 220) {
    return false;
  }
  if (/^(search result|sort by|relevance|latest|top sales|price|find similar|customer service|shop type)$/i.test(line)) {
    return false;
  }
  return /\b(vacuum|cleaner|desktop|desk|keyboard|handheld|cordless|rechargeable)\b/i.test(line);
}

function looksLike1688OfferTitle(line: string): boolean {
  if (line.length < 8 || line.length > 220) {
    return false;
  }
  if (/^(Alibaba|阿里巴巴|验证|登录|搜索|筛选)$/i.test(line)) {
    return false;
  }
  return /\b(vacuum|cleaner|desktop|desk|keyboard|handheld|cordless|rechargeable)\b/i.test(line) || /吸尘|清洁|桌面|键盘/.test(line);
}

function looksLikeTaobaoOfferTitle(line: string): boolean {
  if (line.length < 10 || line.length > 260) {
    return false;
  }
  if (
    /^(中国大陆|亲，请登录|免费注册|网页无障碍|搜索|搜同款|所有宝贝|天猫|淘宝|店铺|企业购|发货地|综合|销量|价格|筛选|大家都在搜|上一页|下一页)$/i.test(
      line,
    )
  ) {
    return false;
  }
  return /吸尘|清洁|桌面|键盘|橡皮|手持|充电|迷你|vacuum|cleaner|desktop|desk|keyboard/i.test(line);
}

function findNextPriceIndex(lines: string[], start: number, windowSize: number): number {
  for (let index = start; index < Math.min(lines.length, start + windowSize); index += 1) {
    if (parsePrice(lines[index]) > 0) {
      return index;
    }
    if (lines[index] === "$" && parsePrice(lines[index + 1] ?? "") > 0) {
      return index + 1;
    }
  }
  return -1;
}

function findNextCnyPriceIndex(lines: string[], start: number, windowSize: number): number {
  for (let index = start; index < Math.min(lines.length, start + windowSize); index += 1) {
    if (parsePrice(lines[index]) > 0 && /¥|￥|元|RMB|CNY|起/.test(lines.slice(index - 1, index + 2).join(" "))) {
      return index;
    }
  }
  return -1;
}

function findNextLine(
  lines: string[],
  start: number,
  windowSize: number,
  predicate: (line: string) => boolean,
): number {
  for (let index = start; index < Math.min(lines.length, start + windowSize); index += 1) {
    if (predicate(lines[index])) {
      return index;
    }
  }
  return -1;
}

function parsePrice(value: string): number {
  const match = value.match(/(?:[$¥￥]|SGD|RMB|CNY)?\s*([0-9]+(?:\.[0-9]{1,2})?)/i);
  return match ? Number(match[1]) : 0;
}

function parseTaobaoPrice(lines: string[], yenIndex: number): number {
  const inline = parsePrice(lines[yenIndex]);
  if (inline > 0) {
    return inline;
  }

  const whole = lines[yenIndex + 1] ?? "";
  const fraction = lines[yenIndex + 2] ?? "";
  if (/^\d+$/.test(whole) && /^\.\d{1,2}$/.test(fraction)) {
    return Number(`${whole}${fraction}`);
  }
  return parsePrice(whole);
}

function inferTaobaoSupplier(lines: string[], yenIndex: number, paymentLine: number, locationStart: number): string {
  const searchStart = Math.max(yenIndex + 1, paymentLine >= 0 ? paymentLine + 1 : yenIndex + 1);
  const searchEnd = locationStart >= 0 ? Math.min(lines.length, locationStart + 8) : Math.min(lines.length, searchStart + 12);
  for (let index = searchStart; index < searchEnd; index += 1) {
    const line = lines[index];
    if (/店|旗舰店|专营店|企业店|官方/.test(line) && line.length <= 40) {
      return line;
    }
  }
  return "Unknown Taobao seller";
}

function findNextRating(lines: string[], start: number, windowSize: number): number {
  for (let index = start; index < Math.min(lines.length, start + windowSize); index += 1) {
    const value = Number(lines[index]);
    if (value >= 0 && value <= 5) {
      return value;
    }
  }
  return 0;
}

function keywordHints(text: string): string[] {
  const hints = ["mini desk vacuum", "keyboard cleaner", "USB vacuum", "home office", "Shopee"];
  const normalized = text.toLowerCase();
  return hints.filter((hint) => normalized.includes(hint.toLowerCase())).slice(0, 5);
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function truncate(text: string, maxLength: number): string {
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 3)}...`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
