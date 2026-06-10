import { createHash } from "node:crypto";
import { includesQuery, nowIso, readSeedJson, roundMoney } from "../shared";
import type { ProviderWarning } from "../shared";
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

// SSRF guard: google.com is intentionally NOT in the allowlist — its open-redirect
// (google.com/url?q=...) would let the server-side browser be steered to internal IPs
// or cloud metadata. Web-trend therefore returns empty unless a specific source is added.
const DEFAULT_ALLOWED_DOMAINS = [
  "shopee.sg",
  "seller.shopee.sg",
  "ads.shopee.sg",
  "shopee.com.my",
  "shopee.co.th",
  "shopee.co.id",
  "shopee.ph",
  "shopee.vn",
  "shopee.com.br",
  "1688.com",
  "detail.1688.com",
  "s.1688.com",
  "taobao.com",
  "s.taobao.com",
  "tmall.com",
  "detail.tmall.com",
];

// Map a target market to its Shopee storefront domain. Unknown markets fall back to shopee.sg.
const SHOPEE_MARKET_DOMAINS: Record<string, string> = {
  singapore: "shopee.sg",
  sg: "shopee.sg",
  malaysia: "shopee.com.my",
  my: "shopee.com.my",
  thailand: "shopee.co.th",
  th: "shopee.co.th",
  indonesia: "shopee.co.id",
  id: "shopee.co.id",
  philippines: "shopee.ph",
  ph: "shopee.ph",
  vietnam: "shopee.vn",
  vn: "shopee.vn",
  brazil: "shopee.com.br",
  br: "shopee.com.br",
};

function shopeeDomainForMarket(market: string | undefined): string {
  const key = (market ?? "").trim().toLowerCase();
  return SHOPEE_MARKET_DOMAINS[key] ?? "shopee.sg";
}

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
      // Do NOT fabricate matches: an unmatched query yields an empty product set + warning
      // (Taobao seed path is the honest model) instead of returning desk-vacuum rows.
      const matched = seed.products.filter((product) => includesQuery(product.title, input.query));
      const products = matched.slice(0, input.limit ?? matched.length);
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
      const warnings: ProviderWarning[] = matched.length
        ? []
        : [
            {
              code: "SEED_QUERY_MISMATCH",
              severity: "warning",
              message: `Seed Shopee data does not cover "${input.query}"; returning no products rather than fabricating unrelated rows. Enable Chrome mode for arbitrary queries.`,
            },
          ];

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
        warnings: warnings.length ? warnings : undefined,
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
      // Do NOT fabricate matches: an unmatched query yields an empty offer set + warning
      // instead of returning the desk-vacuum seed as if it were the requested product.
      const matched = seed.offers.filter((offer) => includesQuery(offer.title, input.query));
      const offers = matched.slice(0, input.limit ?? matched.length);
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
      const warnings: ProviderWarning[] = matched.length
        ? []
        : [
            {
              code: "SEED_QUERY_MISMATCH",
              severity: "warning",
              message: `Seed 1688 data does not cover "${input.query}"; returning no offers rather than fabricating unrelated rows. Enable Chrome mode for arbitrary queries.`,
            },
          ];

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
        warnings: warnings.length ? warnings : undefined,
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

    async extractTaobaoOffer(input: Browser1688OfferInput): Promise<BrowserUnavailableResult> {
      const capturedAt = nowIso();
      const url = input.url ?? "https://item.taobao.com/";
      const snapshot = createSnapshot({
        url,
        capturedAt,
        text: `No seed Taobao offer detail was performed for ${input.offerId ?? input.url ?? "unknown offer"}.`,
        method: "seed",
        confidence: 0.2,
        selectorNotes: ["taobao detail live browser extraction disabled in seed mode"],
        warnings: ["Seed mode does not fabricate Taobao offer detail fields."],
      });

      return {
        source: source("browser-retrieval", "seed", capturedAt, url, snapshot),
        available: false,
        reason: "Seed mode does not provide Taobao offer detail; use a user-authorized Chrome session.",
        requires_human_input: true,
        snapshot,
        warnings: [
          {
            code: "TAOBAO_DETAIL_SEED_EMPTY",
            severity: "info",
            message: "Seed mode returns no Taobao offer detail; use Chrome mode for real sourcing specs.",
          },
        ],
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
      // SSRF guard: Chrome follows redirects, so the FINAL landing URL must also be on the
      // allowlist. If a redirect escaped (e.g. open-redirect to an internal IP), discard the
      // captured body and fail rather than trust off-allowlist content.
      const finalUrl = captured.url || input.url;
      if (!isAllowedUrl(finalUrl, policy.allowed_domains)) {
        throw new Error(
          `Browser retrieval followed a redirect to a disallowed URL ${finalUrl} (from ${input.url}); captured content was discarded.`,
        );
      }
      return toPageSnapshot(input.url, input.purpose, captured);
    },

    async extractShopeeSearch(input: BrowserShopeeSearchInput): Promise<BrowserShopeeSearchResult> {
      const limit = input.limit ?? 20;
      const domain = shopeeDomainForMarket(input.market);
      const baseUrl = `https://${domain}/search?keyword=${encodeURIComponent(input.query)}`;
      const scan = await scanSearchPages<BrowserShopeeProductSignal>({
        retrieve: (url) =>
          this.retrievePageSnapshot({
            url,
            purpose: "market_shopee_search",
            policy: { max_steps: 8, ...input.policy },
          }),
        // Shopee search pagination is 0-based via the `page` query param.
        pageUrl: (pageIndex) => (pageIndex === 0 ? baseUrl : `${baseUrl}&page=${pageIndex}`),
        pages: input.pages,
        limit,
        throwOnFirstPageChallenge: false,
        parsePage: (page, remaining) =>
          parseShopeeProducts(pageText(page), remaining).map((product) => ({
            key: `${normalizeLoose(product.title)}|${product.price_sgd}`,
            value: product,
          })),
      });
      const products = scan.items;
      const prices = products.map((product) => product.price_sgd).sort((a, b) => a - b);
      const warnings: ProviderWarning[] = [
        ...scan.warnings,
        ...(products.length === 0
          ? [
              {
                code: "CHROME_SHOPEE_PRODUCTS_NOT_FOUND",
                severity: "warning" as const,
                message: "Chrome captured a Shopee page, but no visible product rows were parsed.",
              },
            ]
          : []),
      ];
      return {
        source: scan.firstPage.source,
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
        snapshot: scan.firstPage.snapshot,
        pages_scanned: scan.pagesScanned,
        page_snapshots: scan.snapshots,
        warnings: warnings.length ? warnings : undefined,
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
      // SSRF guard: google.com was removed from the allowlist (open-redirect risk), so live
      // web-trend has no permitted source in this MVP and returns empty + a warning rather
      // than scraping an off-allowlist search engine.
      const capturedAt = nowIso();
      const url = `https://shopee.sg/search?keyword=${encodeURIComponent(input.query)}`;
      const snapshot = createSnapshot({
        url,
        capturedAt,
        text: `Live web trend disabled: no allowlisted trend source is configured for ${input.query}.`,
        method: "manual_snapshot",
        confidence: 0.2,
        selectorNotes: ["web trend live search disabled in chrome mode (no allowlisted source)"],
        warnings: ["No allowlisted web-trend source; google.com is intentionally not allowed."],
      });
      return {
        source: source("browser-retrieval", "snapshot", capturedAt, url, snapshot),
        query: input.query,
        market: input.market,
        articles: [],
        trend_keywords: [],
        snapshot,
        warnings: [
          {
            code: "WEB_TREND_NO_ALLOWLISTED_SOURCE",
            severity: "info",
            message: "Live web trend has no allowlisted source (google.com removed for SSRF safety); configure a specific trend domain to enable it.",
          },
        ],
      };
    },

    async extract1688Search(input: Browser1688SearchInput): Promise<Browser1688SearchResult> {
      const limit = input.limit ?? 20;
      const baseUrl = `https://s.1688.com/selloffer/offer_search.htm?keywords=${encode1688Keyword(input.query)}`;
      const scan = await scanSearchPages<Browser1688OfferSignal>({
        retrieve: (url) =>
          this.retrievePageSnapshot({
            url,
            purpose: "sourcing_1688_search",
            policy: { max_steps: 8, ...input.policy },
          }),
        // 1688 search pagination is 1-based via the `beginPage` query param.
        pageUrl: (pageIndex) => (pageIndex === 0 ? baseUrl : `${baseUrl}&beginPage=${pageIndex + 1}`),
        pages: input.pages,
        limit,
        throwOnFirstPageChallenge: true,
        parsePage: (page, remaining) =>
          parse1688Offers(pageText(page), remaining, page.links).map((offer) => ({
            key: `${normalizeLoose(offer.title)}|${offer.source_price_cny}`,
            value: offer,
          })),
      });
      if (scan.items.length === 0) {
        throw new Error(
          `No visible 1688 offer rows were parsed for ${scan.firstPage.url}. Human login/refresh or parser update is required; seed/mock data was not used.`,
        );
      }
      return {
        source: scan.firstPage.source,
        query: input.query,
        offers: scan.items,
        snapshot: scan.firstPage.snapshot,
        pages_scanned: scan.pagesScanned,
        page_snapshots: scan.snapshots,
        warnings: scan.warnings.length ? scan.warnings : undefined,
      };
    },

    async extractTaobaoSearch(input: BrowserTaobaoSearchInput): Promise<BrowserTaobaoSearchResult> {
      const limit = input.limit ?? 20;
      const baseUrl = `https://s.taobao.com/search?q=${encodeURIComponent(input.query)}`;
      const scan = await scanSearchPages<Browser1688OfferSignal>({
        retrieve: (url) =>
          this.retrievePageSnapshot({
            url,
            purpose: "sourcing_taobao_search",
            policy: { max_steps: 8, ...input.policy },
          }),
        // Taobao accepts both the modern `page` param and the legacy `s` row offset; send both.
        pageUrl: (pageIndex) =>
          pageIndex === 0 ? baseUrl : `${baseUrl}&page=${pageIndex + 1}&s=${44 * pageIndex}`,
        pages: input.pages,
        limit,
        throwOnFirstPageChallenge: true,
        parsePage: (page, remaining) =>
          parseTaobaoOffers(pageText(page), remaining, page.links).map((offer) => ({
            key: `${normalizeLoose(offer.title)}|${offer.source_price_cny}`,
            value: offer,
          })),
      });
      if (scan.items.length === 0) {
        throw new Error(
          `No visible Taobao product rows were parsed for ${scan.firstPage.url}. Human login/refresh or parser update is required; seed/mock data was not used.`,
        );
      }
      return {
        source: scan.firstPage.source,
        query: input.query,
        offers: scan.items,
        snapshot: scan.firstPage.snapshot,
        pages_scanned: scan.pagesScanned,
        page_snapshots: scan.snapshots,
        warnings: scan.warnings.length ? scan.warnings : undefined,
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
      const page = await this.retrievePageSnapshot({
        url: input.url,
        purpose: "sourcing_1688_offer",
        policy: { max_steps: 12, ...input.policy },
      });
      assertNoAccessChallenge(pageText(page), page.url);
      const detail = parseSourcingOfferDetailPage(page, input, "1688");
      if (!detail.available) {
        return unavailableBrowserResult({
          page,
          code: detail.code,
          message: detail.reason,
          requiresHumanInput: detail.requiresHumanInput,
        });
      }
      return {
        source: page.source,
        offer: detail.offer,
        snapshot: page.snapshot,
      };
    },

    async extractTaobaoOffer(input: Browser1688OfferInput): Promise<Browser1688OfferResult | BrowserUnavailableResult> {
      if (!input.url) {
        return unavailableBrowserResult({
          url: "https://item.taobao.com/",
          code: "CHROME_TAOBAO_OFFER_URL_REQUIRED",
          message: "Chrome Taobao offer extraction requires an item URL; no browser page was opened.",
          requiresHumanInput: true,
        });
      }
      const page = await this.retrievePageSnapshot({
        url: input.url,
        purpose: "sourcing_taobao_offer",
        policy: { max_steps: 12, ...input.policy },
      });
      assertNoAccessChallenge(pageText(page), page.url);
      const detail = parseSourcingOfferDetailPage(page, input, "taobao");
      if (!detail.available) {
        return unavailableBrowserResult({
          page,
          code: detail.code,
          message: detail.reason,
          requiresHumanInput: detail.requiresHumanInput,
        });
      }
      return {
        source: page.source,
        offer: detail.offer,
        snapshot: page.snapshot,
      };
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
  const scanNotes = captured.scan
    ? [`incremental scan: ${captured.scan.steps} step(s), reached_end=${captured.scan.reached_end}`]
    : [];
  const snapshot = createSnapshot({
    url,
    capturedAt,
    text: captured.text,
    method: "chrome",
    screenshotPath: captured.screenshot_path,
    confidence: captured.scan?.reached_end ? 0.78 : 0.7,
    selectorNotes: [`chrome controller snapshot for ${purpose}`, ...scanNotes],
    warnings:
      captured.scan && !captured.scan.reached_end
        ? ["Scan stopped before the page bottom (max_steps or text budget); rows further down may be missing."]
        : [],
  });

  return {
    source: source("browser-retrieval", "browser", capturedAt, url, snapshot),
    url,
    title: captured.title,
    text_excerpt: truncate(captured.text, 25_000),
    text_full: truncate(captured.text, 150_000),
    links: captured.links ?? [],
    snapshot,
  };
}

/** Parsers should see the full accumulated scan text, not the 25k agent-facing excerpt. */
function pageText(page: BrowserRetrievePageSnapshotResult): string {
  return page.text_full ?? page.text_excerpt;
}

interface PagedScanOptions<T> {
  retrieve: (url: string) => Promise<BrowserRetrievePageSnapshotResult>;
  pageUrl: (pageIndex: number) => string;
  pages?: number;
  limit: number;
  /** Sourcing platforms hard-fail on a first-page challenge; Shopee degrades to a warning. */
  throwOnFirstPageChallenge: boolean;
  parsePage: (page: BrowserRetrievePageSnapshotResult, remaining: number) => Array<{ key: string; value: T }>;
}

interface PagedScanResult<T> {
  items: T[];
  firstPage: BrowserRetrievePageSnapshotResult;
  pagesScanned: number;
  snapshots: BrowserSnapshotEvidence[];
  warnings: ProviderWarning[];
}

/**
 * Multi-page search scan with cross-page dedupe. Key behaviors:
 * - Rows already collected are NEVER discarded when a later page fails or hits a verification
 *   wall; the failure becomes a warning so the agent can decide with partial evidence.
 * - Items are deduped across pages (and across overlapping scroll captures within one page)
 *   by a caller-provided key, so repeated rows do not crowd out the limit.
 * - Stops early when a page contributes nothing new (end of real results).
 */
async function scanSearchPages<T>(options: PagedScanOptions<T>): Promise<PagedScanResult<T>> {
  const maxPages = clamp(Math.floor(options.pages ?? 1), 1, 5);
  const items: T[] = [];
  const seen = new Set<string>();
  const snapshots: BrowserSnapshotEvidence[] = [];
  const warnings: ProviderWarning[] = [];
  let firstPage: BrowserRetrievePageSnapshotResult | undefined;
  let pagesScanned = 0;

  for (let pageIndex = 0; pageIndex < maxPages && items.length < options.limit; pageIndex += 1) {
    let page: BrowserRetrievePageSnapshotResult;
    try {
      page = await options.retrieve(options.pageUrl(pageIndex));
    } catch (error) {
      if (pageIndex === 0) {
        throw error;
      }
      warnings.push({
        code: "CHROME_PAGINATION_PAGE_FAILED",
        severity: "warning",
        message: `Capture of search page ${pageIndex + 1} failed (${
          error instanceof Error ? error.message : String(error)
        }); ${items.length} row(s) from earlier pages were kept.`,
      });
      break;
    }

    firstPage ??= page;
    pagesScanned += 1;
    snapshots.push(page.snapshot);

    if (isAccessChallenge(pageText(page))) {
      if (pageIndex === 0 && options.throwOnFirstPageChallenge) {
        throw new Error(
          `Browser retrieval hit an access verification page for ${page.url}. Human login/verification or an authorized API is required; seed/mock data was not used.`,
        );
      }
      warnings.push({
        code: "CHROME_PAGINATION_ACCESS_CHALLENGE",
        severity: "warning",
        message: `Access verification appeared on search page ${pageIndex + 1} (${page.url}); scan stopped and ${items.length} row(s) already collected were kept.`,
      });
      break;
    }

    let added = 0;
    for (const entry of options.parsePage(page, options.limit - items.length)) {
      if (seen.has(entry.key)) {
        continue;
      }
      seen.add(entry.key);
      items.push(entry.value);
      added += 1;
      if (items.length >= options.limit) {
        break;
      }
    }

    if (added === 0 && pageIndex > 0) {
      warnings.push({
        code: "CHROME_PAGINATION_NO_NEW_ROWS",
        severity: "info",
        message: `Search page ${pageIndex + 1} added no new rows; pagination stopped early.`,
      });
      break;
    }
  }

  if (!firstPage) {
    throw new Error("Browser pagination captured no search page.");
  }

  return { items, firstPage, pagesScanned, snapshots, warnings };
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

function isAllowedUrl(url: string, allowedDomains: string[]): boolean {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return false;
  }
  // SSRF guard: only https — block http/file/data/ftp/etc. that could reach internal services.
  if (target.protocol !== "https:") {
    return false;
  }
  return allowedDomains.some(
    (domain) => target.hostname === domain || target.hostname.endsWith(`.${domain}`),
  );
}

function assertAllowedUrl(url: string, policy: BrowserRetrievalPolicy): void {
  let target: URL;
  try {
    target = new URL(url);
  } catch {
    throw new Error(`Browser retrieval blocked for invalid URL: ${url}`);
  }
  if (target.protocol !== "https:") {
    throw new Error(`Browser retrieval blocked for non-https URL ${url}; only https is allowed.`);
  }
  if (!isAllowedUrl(url, policy.allowed_domains)) {
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
      "Ask supplier to verify packed weight and dimensions for the logistics rate estimate.",
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
  const seen = new Set<string>();

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

    const dedupeKey = `${normalizeLoose(title)}|${price}`;
    if (seen.has(dedupeKey)) {
      index = priceIndex;
      continue;
    }
    seen.add(dedupeKey);

    const rating = findNextRating(lines, priceIndex + 1, 8);
    const window = lines.slice(Math.max(0, index - 3), index + 8).join(" ");
    const shopType = /mall/i.test(window) ? "mall" : /preferred/i.test(window) ? "preferred" : "marketplace";
    // Shopee shows a "X sold" / "X.Yk sold" label rather than a raw review count. Parse it when
    // visible; the explicit review count is NOT reliably scrapeable from the search grid, so we
    // leave review_count at 0 and flag the limitation in the evidence label rather than inventing one.
    const soldLabel = parseShopeeSoldLabel(lines, priceIndex + 1, 8);
    const reviewCount = parseShopeeReviewCount(lines, priceIndex + 1, 8);

    products.push({
      item_id: `live_shopee_${hashText(`${title}:${price}`).slice(0, 12)}`,
      title,
      price_sgd: price,
      rating,
      review_count: reviewCount,
      sold_label: soldLabel,
      shop_type: shopType,
      evidence_label:
        `Chrome visible Shopee row: ${title} at SGD ${price.toFixed(2)}` +
        (soldLabel ? ` (${soldLabel})` : "") +
        (reviewCount > 0 ? "" : " — review count not visible in search grid"),
    });

    index = priceIndex;
  }

  return products;
}

/** Shopee search rows show a "X sold" / "1.2k sold" label; return it verbatim if visible. */
function parseShopeeSoldLabel(lines: string[], start: number, windowSize: number): string | undefined {
  for (let index = start; index < Math.min(lines.length, start + windowSize); index += 1) {
    const match = lines[index].match(/(\d[\d.,]*\s*k?\+?)\s*sold/i);
    if (match) {
      return `${match[1].replace(/\s+/g, "")} sold`;
    }
  }
  return undefined;
}

/** Parse an explicit review/rating-count like "(1.2k)" or "1234 ratings" when visible; else 0. */
function parseShopeeReviewCount(lines: string[], start: number, windowSize: number): number {
  for (let index = start; index < Math.min(lines.length, start + windowSize); index += 1) {
    const match = lines[index].match(/(\d[\d.,]*)\s*(k)?\s*(?:ratings?|reviews?)/i);
    if (match) {
      const base = Number(match[1].replace(/,/g, ""));
      if (Number.isFinite(base)) {
        return Math.round(match[2] ? base * 1000 : base);
      }
    }
  }
  return 0;
}

function parse1688Offers(
  text: string,
  limit: number,
  links: Array<{ label: string; url: string }> = [],
): Browser1688OfferSignal[] {
  const lines = visibleLines(text);
  const offers: Browser1688OfferSignal[] = [];
  const usedUrls = new Set<string>();
  const seen = new Set<string>();

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

    const dedupeKey = `${normalizeLoose(title)}|${price}`;
    if (seen.has(dedupeKey)) {
      index = priceIndex;
      continue;
    }
    seen.add(dedupeKey);

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
      source_url: matchOfferLink(links, title, "1688", usedUrls),
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

function parseTaobaoOffers(
  text: string,
  limit: number,
  links: Array<{ label: string; url: string }> = [],
): Browser1688OfferSignal[] {
  const lines = visibleLines(text);
  const offers: Browser1688OfferSignal[] = [];
  const seen = new Set<string>();
  const usedUrls = new Set<string>();

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
      source_url: matchOfferLink(links, title, "taobao", usedUrls),
      evidence_label: `Chrome visible Taobao row: ${title} at CNY ${price.toFixed(2)}`,
    });

    index = yenIndex;
  }

  return offers;
}

type SourcingDetailPlatform = "1688" | "taobao";

type SourcingDetailParseResult =
  | { available: true; offer: Browser1688OfferDetail }
  | { available: false; code: string; reason: string; requiresHumanInput: boolean };

function parseSourcingOfferDetailPage(
  page: BrowserRetrievePageSnapshotResult,
  input: Browser1688OfferInput,
  platform: SourcingDetailPlatform,
): SourcingDetailParseResult {
  const text = pageText(page);
  const lines = visibleLines(text);
  const title = inferDetailTitle(lines, page.title, platform);
  const price = inferDetailPrice(lines, title);
  const weight = parsePackageWeight(text);
  const dimensions = parsePackageDimensions(text);
  const stock = parseStockSignal(text);
  const supplier = inferSupplierProfile(lines, platform);
  const missing = [
    title ? "" : "product title",
    price > 0 ? "" : "source price",
    weight ? "" : "package weight",
    dimensions ? "" : "package dimensions",
    stock ? "" : "stock or in-stock signal",
    supplier.supplier_name !== "Unknown visible supplier" ? "" : "shop/supplier name",
  ].filter(Boolean);

  if (!title || price <= 0 || !weight || !dimensions || !stock || missing.length > 0) {
    return {
      available: false,
      code: platform === "1688" ? "CHROME_1688_OFFER_DETAIL_INCOMPLETE" : "CHROME_TAOBAO_OFFER_DETAIL_INCOMPLETE",
      reason: `Chrome captured ${platform} offer detail ${page.url}, but these comparable-spec fields were not visible: ${missing.join(
        ", ",
      )}. Ask the user to log in/open the detail page or update the parser; seed/mock specs were not used.`,
      requiresHumanInput: true,
    };
  }

  const offerId = input.offerId ?? `${platform === "1688" ? "live_1688" : "live_taobao"}_${hashText(page.url).slice(0, 12)}`;
  const supplierRiskNotes = [
    ...(hasSingleDimensionSignal(text)
      ? ["Dimension field showed one value under 长x宽x高; interpreted as equal length/width/height and requires supplier confirmation."]
      : []),
    ...(stock.exact ? [] : ["Visible in-stock signal was present, but exact stock quantity was not visible; confirm with supplier."]),
    ...(supplier.supplier_name === "Unknown visible supplier" ? ["Supplier/shop name was not visible in detail parser."] : []),
  ];
  const offer: Browser1688OfferDetail = {
    offer_id: offerId,
    title,
    source_price_cny: price,
    currency: "CNY",
    moq: parseMoq(text) ?? 1,
    available_stock: stock.value,
    supplier_name: supplier.supplier_name,
    supplier_location: supplier.supplier_location,
    domestic_dispatch_days: parseDispatchDays(text) ?? 3,
    source_url: page.url,
    evidence_label: `Chrome visible ${platform} detail: ${title} at CNY ${price.toFixed(2)}`,
    sku_options: parseSkuOptions(lines),
    package_weight_g: weight,
    package_dimensions_cm: dimensions,
    price_ladder: [{ min_qty: parseMoq(text) ?? 1, unit_price_cny: price }],
    supplier_stability: {
      supplier_name: supplier.supplier_name,
      supplier_location: supplier.supplier_location,
      stability_score: scoreDetailSupplier(stock.value, supplierRiskNotes.length),
      supplier_years: parseSupplierYears(text),
      dispute_or_risk_notes: supplierRiskNotes,
    },
    last_seen_stock: stock.value,
    last_seen_at: page.source.captured_at,
    negotiation_notes: [
      "Confirm that the parsed package weight/dimensions match the exact SKU before buying test stock.",
      "Confirm current stock and dispatch time before committing test order.",
      "Ask supplier for USB/electrical safety notes before Shopee launch.",
    ],
    supplier_risk_notes: supplierRiskNotes,
  };

  return { available: true, offer };
}

function matchOfferLink(
  links: Array<{ label: string; url: string }>,
  title: string,
  platform: SourcingDetailPlatform,
  usedUrls: Set<string>,
): string | undefined {
  const candidates = links
    .filter((link) => isOfferDetailUrl(link.url, platform) && !usedUrls.has(link.url))
    .map((link) => ({ ...link, score: titleLinkScore(title, link.label, link.url) }))
    .sort((left, right) => right.score - left.score);
  const best = candidates.find((link) => link.score > 0) ?? candidates[0];
  if (!best) {
    return undefined;
  }
  usedUrls.add(best.url);
  return best.url;
}

function isOfferDetailUrl(url: string, platform: SourcingDetailPlatform): boolean {
  try {
    const target = new URL(url);
    if (platform === "1688") {
      return /(^|\.)1688\.com$/.test(target.hostname) && /\/offer\/|offerId=|detail/.test(target.href);
    }
    return (
      /(^|\.)taobao\.com$|(^|\.)tmall\.com$/.test(target.hostname) &&
      /item\.htm|itemId=|id=|detail/.test(target.href)
    );
  } catch {
    return false;
  }
}

function titleLinkScore(title: string, label: string, url: string): number {
  const normalizedTitle = normalizeLoose(title);
  const normalizedLabel = normalizeLoose(label);
  let score = 0;
  if (normalizedLabel && (normalizedTitle.includes(normalizedLabel) || normalizedLabel.includes(normalizedTitle.slice(0, 24)))) {
    score += 30;
  }
  for (const token of titleTokens(title)) {
    if (normalizedLabel.includes(token)) {
      score += 4;
    }
  }
  if (/offer|item|detail/.test(url)) {
    score += 1;
  }
  return score;
}

function titleTokens(title: string): string[] {
  const normalized = normalizeLoose(title);
  const ascii = normalized.split(/\s+/).filter((token) => token.length >= 3);
  const chinese = Array.from(title.matchAll(/[\u4e00-\u9fa5]{2,}/g))
    .flatMap((match) => chunks(match[0], 2))
    .filter((token) => /吸尘|桌面|清洁|键盘|迷你|充电|学生/.test(token));
  return unique([...ascii, ...chinese]);
}

function inferDetailTitle(lines: string[], fallbackTitle: string, platform: SourcingDetailPlatform): string {
  const matcher = platform === "1688" ? looksLike1688OfferTitle : looksLikeTaobaoOfferTitle;
  return (
    lines.find((line) => matcher(line) && !/推荐|相似|大家都在/.test(line)) ??
    fallbackTitle.replace(/[-_].*$/, "").trim()
  );
}

function inferDetailPrice(lines: string[], title: string): number {
  const titleIndex = lines.findIndex((line) => line === title);
  const searchStart = titleIndex >= 0 ? titleIndex + 1 : 0;
  const nearby = findNextCnyPriceIndex(lines, searchStart, 40);
  if (nearby >= 0) {
    return parsePrice(lines[nearby]);
  }
  const prices = lines
    .map(parsePrice)
    .filter((value) => value > 0 && value < 10_000)
    .sort((left, right) => left - right);
  return prices[0] ?? 0;
}

function parsePackageWeight(text: string): number | undefined {
  const patterns = [
    /(?:商品件重尺[\s\S]{0,80})?重量\s*[（(]\s*g\s*[)）][^\d]{0,20}(\d+(?:\.\d+)?)/i,
    /(?:净重|毛重|包装重量|产品重量|商品重量|重量)[^\d]{0,20}(\d+(?:\.\d+)?)(?!\s*(?:cm|厘米|mm|毫米))/i,
    /(?:包装重量|产品重量|商品重量|净重|毛重|重量|weight)[^\d]{0,16}(\d+(?:\.\d+)?)\s*(kg|公斤|千克|g|克)/i,
    /(\d+(?:\.\d+)?)\s*(kg|公斤|千克|g|克)[^\n]{0,16}(?:包装重量|产品重量|商品重量|净重|毛重|重量|weight)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) {
      continue;
    }
    const value = Number(match[1]);
    const unit = (match[2] ?? inferWeightUnitFromMatch(match[0], value)).toLowerCase();
    if (!Number.isFinite(value) || value <= 0) {
      continue;
    }
    return /kg|公斤|千克/.test(unit) ? Math.round(value * 1000) : Math.round(value);
  }
  return undefined;
}

function parsePackageDimensions(text: string): { length: number; width: number; height: number } | undefined {
  const normalized = text.replace(/[×＊*]/g, "x").replace(/[()（）]/g, "");
  const patterns = [
    /(?:长\s*x\s*宽\s*x\s*高|长宽高|包装尺寸|产品尺寸|商品尺寸|外箱尺寸|尺寸|规格|dimension)[^\d]{0,40}(\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米)?\s*x\s*(\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米)?\s*x\s*(\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米)?/i,
    /(\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米)?\s*x\s*(\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米)?\s*x\s*(\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米)?[^\n]{0,40}(?:长\s*x\s*宽\s*x\s*高|长宽高|包装尺寸|产品尺寸|商品尺寸|尺寸|规格|dimension)/i,
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match) {
      continue;
    }
    const values = [Number(match[1]), Number(match[3]), Number(match[5])];
    if (values.some((value) => !Number.isFinite(value) || value <= 0)) {
      continue;
    }
    const unit = [match[2], match[4], match[6]].filter(Boolean).join(" ").toLowerCase();
    const scale = /mm|毫米/.test(unit) ? 0.1 : 1;
    return {
      length: roundDimension(values[0] * scale),
      width: roundDimension(values[1] * scale),
      height: roundDimension(values[2] * scale),
    };
  }
  const single = normalized.match(/(?:长\s*x\s*宽\s*x\s*高|长宽高)[^\d]{0,40}(\d+(?:\.\d+)?)\s*(cm|厘米|mm|毫米)/i);
  if (single) {
    const value = Number(single[1]);
    if (Number.isFinite(value) && value > 0) {
      const scale = /mm|毫米/i.test(single[2]) ? 0.1 : 1;
      const dimension = roundDimension(value * scale);
      return { length: dimension, width: dimension, height: dimension };
    }
  }
  return undefined;
}

function hasSingleDimensionSignal(text: string): boolean {
  return /(?:长\s*x\s*宽\s*x\s*高|长宽高)[^\d]{0,40}\d+(?:\.\d+)?\s*(?:cm|厘米|mm|毫米)/i.test(
    text.replace(/[×＊*]/g, "x").replace(/[()（）]/g, ""),
  );
}

function inferWeightUnitFromMatch(matchText: string, value: number): string {
  if (/重量\s*[（(]\s*g\s*[)）]/i.test(matchText)) {
    return "g";
  }
  if (/净重|毛重/i.test(matchText) && value > 0 && value <= 10) {
    return "kg";
  }
  return value >= 20 ? "g" : "kg";
}

function parseStockSignal(text: string): { value: number; exact: boolean } | undefined {
  const exactPatterns = [
    /(?:库存|可售|现货)[^\d]{0,12}(\d{1,8})\s*(?:件|个|台|套)?/,
    /(\d{1,8})\s*(?:件|个|台|套)?[^\n]{0,8}(?:库存|可售|现货)/,
  ];
  for (const pattern of exactPatterns) {
    const match = text.match(pattern);
    if (match) {
      const value = Number(match[1]);
      if (Number.isFinite(value) && value >= 0) {
        return { value, exact: true };
      }
    }
  }
  if (/库存充足|现货|有货|in stock/i.test(text)) {
    return { value: 1, exact: false };
  }
  return undefined;
}

function inferSupplierProfile(
  lines: string[],
  platform: SourcingDetailPlatform,
): { supplier_name: string; supplier_location: string } {
  const supplierLine = lines.find((line) => isSupplierNameLine(line, platform)) ?? "Unknown visible supplier";
  const locationLine = lines.find((line) => isLocationLine(line)) ?? "Unknown";
  return {
    supplier_name: supplierLine,
    supplier_location: locationLine,
  };
}

function isSupplierNameLine(line: string, platform: SourcingDetailPlatform): boolean {
  if (line.length < 3 || line.length > 60) {
    return false;
  }
  if (/客服|联系|收藏|关注|商品|价格|库存|规格|参数|详情|评价|推荐|搜索|登录|注册/.test(line)) {
    return false;
  }
  return platform === "1688"
    ? /公司|工厂|厂|店|商行|贸易|批发|供应链/.test(line)
    : /店|旗舰店|专营店|企业店|官方|工厂|公司/.test(line);
}

function isLocationLine(line: string): boolean {
  return /广东|浙江|江苏|福建|上海|北京|深圳|广州|义乌|东莞|汕头|宁波|杭州|泉州|合肥|安徽/.test(line) && line.length <= 30;
}

function parseMoq(text: string): number | undefined {
  const match = text.match(/(?:起批|起订|MOQ|最小起订量)[^\d]{0,12}(\d{1,6})/i);
  return match ? Number(match[1]) : undefined;
}

function parseDispatchDays(text: string): number | undefined {
  const match = text.match(/(?:发货|出货|dispatch|ship)[^\d]{0,16}(\d{1,3})\s*(?:天|日|day)/i);
  return match ? Number(match[1]) : undefined;
}

function parseSupplierYears(text: string): number | undefined {
  const match = text.match(/(\d{1,2})\s*年(?:老店|诚信通|会员|经营)/);
  return match ? Number(match[1]) : undefined;
}

function parseSkuOptions(lines: string[]): Array<{ name: string; options: string[] }> {
  const colorLine = lines.find((line) => /^颜色|颜色分类|Color/i.test(line));
  if (!colorLine) {
    return [];
  }
  const options = colorLine
    .replace(/^颜色分类?[:：]?|^Color[:：]?/i, "")
    .split(/[、,，/|]/)
    .map((item) => item.trim())
    .filter(Boolean)
    .slice(0, 8);
  return options.length ? [{ name: "Color", options }] : [];
}

function scoreDetailSupplier(stock: number, riskNoteCount: number): number {
  return clamp(52 + Math.min(24, stock / 50) - riskNoteCount * 6, 0, 100);
}

function normalizeLoose(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").replace(/\s+/g, " ").trim();
}

function chunks(value: string, size: number): string[] {
  const chars = Array.from(value);
  const output: string[] = [];
  for (let index = 0; index <= chars.length - size; index += 1) {
    output.push(chars.slice(index, index + size).join(""));
  }
  return output;
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

function roundDimension(value: number): number {
  return Math.round(value * 10) / 10;
}

function assertNoAccessChallenge(text: string, url: string): void {
  if (isAccessChallenge(text)) {
    throw new Error(
      `Browser retrieval hit an access verification page for ${url}. Human login/verification or an authorized API is required; seed/mock data was not used.`,
    );
  }
}

function isAccessChallenge(text: string): boolean {
  const trimmed = text.trim();
  // Challenge interstitials are tiny pages. Real search pages are long and may legitimately
  // contain words like "robot vacuum" or "已验证供应商" — never treat those as a wall.
  const strong = /验证码|安全验证|人机验证|滑块|captcha|拖动.*验证|ensure normal access|unusual traffic/i;
  const weak = /验证|robot|人机/i;
  if (strong.test(trimmed)) {
    return trimmed.length < 8_000;
  }
  return weak.test(trimmed) && trimmed.length < 1_500;
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
