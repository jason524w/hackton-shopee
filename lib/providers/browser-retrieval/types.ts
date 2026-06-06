import type { ProviderResultMeta } from "../shared";

export type BrowserRetrievalPurpose =
  | "market_shopee_search"
  | "market_shopee_product"
  | "market_shopee_ads"
  | "market_web_trend"
  | "sourcing_1688_search"
  | "sourcing_1688_offer"
  | "sourcing_taobao_search"
  | "sourcing_taobao_offer"
  | "sourcing_supplier_profile";

export interface BrowserRetrievalPolicy {
  allowed_domains: string[];
  max_steps: number;
  requires_human_login: boolean;
  capture_screenshot: boolean;
  redact_sensitive: boolean;
}

export interface BrowserSnapshotEvidence {
  snapshot_id: string;
  url: string;
  captured_at: string;
  extraction_method: "seed" | "chrome" | "manual_snapshot";
  extracted_text_hash: string;
  screenshot_path?: string;
  selector_notes: string[];
  confidence: number;
  warnings: string[];
}

export interface BrowserRetrievePageSnapshotInput {
  url: string;
  purpose: BrowserRetrievalPurpose;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface BrowserRetrievePageSnapshotResult extends ProviderResultMeta {
  url: string;
  title: string;
  text_excerpt: string;
  links: Array<{ label: string; url: string }>;
  snapshot: BrowserSnapshotEvidence;
}

export interface BrowserShopeeSearchInput {
  query: string;
  market: string;
  category?: string;
  limit?: number;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface BrowserShopeeProductSignal {
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
}

export interface BrowserShopeeSearchResult extends ProviderResultMeta {
  query: string;
  market: string;
  category?: string;
  products: BrowserShopeeProductSignal[];
  competitor_count: number;
  price_band: { low: number; high: number; median: number };
  snapshot: BrowserSnapshotEvidence;
}

export interface BrowserShopeeAdsSignalsInput {
  market: string;
  query?: string;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface BrowserShopeeAdsSignal {
  label: "Best Selling" | "Good ROAS" | "Top Searched" | "Recommended";
  item_id?: string;
  keyword?: string;
  evidence_label: string;
  confidence: number;
}

export interface BrowserShopeeAdsSignalsResult extends ProviderResultMeta {
  market: string;
  available: boolean;
  requires_human_login: boolean;
  signals: BrowserShopeeAdsSignal[];
  snapshot: BrowserSnapshotEvidence;
}

export interface BrowserWebTrendInput {
  query: string;
  market: string;
  limit?: number;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface BrowserWebTrendArticle {
  title: string;
  url: string;
  source_label: string;
  published_at?: string;
  trend_keywords: string[];
  evidence_label: string;
}

export interface BrowserWebTrendResult extends ProviderResultMeta {
  query: string;
  market: string;
  articles: BrowserWebTrendArticle[];
  trend_keywords: string[];
  snapshot: BrowserSnapshotEvidence;
}

export interface Browser1688SearchInput {
  query: string;
  limit?: number;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface Browser1688OfferSignal {
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
}

export interface Browser1688SearchResult extends ProviderResultMeta {
  query: string;
  offers: Browser1688OfferSignal[];
  snapshot: BrowserSnapshotEvidence;
}

export interface BrowserTaobaoSearchInput {
  query: string;
  limit?: number;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface BrowserTaobaoSearchResult extends ProviderResultMeta {
  query: string;
  offers: Browser1688OfferSignal[];
  snapshot: BrowserSnapshotEvidence;
}

export interface Browser1688OfferInput {
  offerId?: string;
  url?: string;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface BrowserSupplierStability {
  supplier_name: string;
  supplier_location: string;
  stability_score: number;
  supplier_years?: number;
  response_rate?: number;
  repeat_buyer_rate?: number;
  on_time_ship_rate?: number;
  dispute_or_risk_notes: string[];
}

export interface BrowserPriceLadder {
  min_qty: number;
  unit_price_cny: number;
}

export interface Browser1688OfferDetail extends Browser1688OfferSignal {
  sku_options: Array<{ name: string; options: string[] }>;
  package_weight_g: number;
  package_dimensions_cm: { length: number; width: number; height: number };
  price_ladder: BrowserPriceLadder[];
  supplier_stability: BrowserSupplierStability;
  last_seen_stock: number;
  last_seen_at: string;
  negotiation_notes: string[];
  supplier_risk_notes: string[];
}

export interface Browser1688OfferResult extends ProviderResultMeta {
  offer: Browser1688OfferDetail;
  snapshot: BrowserSnapshotEvidence;
}

export interface BrowserUnavailableResult extends ProviderResultMeta {
  available: false;
  reason: string;
  requires_human_input: boolean;
  snapshot?: BrowserSnapshotEvidence;
}

export interface BrowserOfferStockInput {
  offerId: string;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface BrowserOfferStockResult extends ProviderResultMeta {
  offer_id: string;
  available_stock: number;
  last_seen_at: string;
  stock_delta?: number;
  snapshot: BrowserSnapshotEvidence;
}

export interface BrowserSupplierSignalsInput {
  offerId?: string;
  supplierName?: string;
  policy?: Partial<BrowserRetrievalPolicy>;
}

export interface BrowserSupplierSignalsResult extends ProviderResultMeta {
  supplier: BrowserSupplierStability;
  snapshot: BrowserSnapshotEvidence;
}

export interface BrowserControllerSnapshot {
  url: string;
  title: string;
  text: string;
  links?: Array<{ label: string; url: string }>;
  screenshot_path?: string;
  captured_at?: string;
}

export interface BrowserController {
  capture(input: {
    url: string;
    purpose: BrowserRetrievalPurpose;
    policy: BrowserRetrievalPolicy;
  }): Promise<BrowserControllerSnapshot>;
}

export interface BrowserRetrievalProvider {
  retrievePageSnapshot(input: BrowserRetrievePageSnapshotInput): Promise<BrowserRetrievePageSnapshotResult>;
  extractShopeeSearch(input: BrowserShopeeSearchInput): Promise<BrowserShopeeSearchResult>;
  extractShopeeAdsSignals(input: BrowserShopeeAdsSignalsInput): Promise<BrowserShopeeAdsSignalsResult>;
  extractWebTrend(input: BrowserWebTrendInput): Promise<BrowserWebTrendResult>;
  extract1688Search(input: Browser1688SearchInput): Promise<Browser1688SearchResult>;
  extractTaobaoSearch(input: BrowserTaobaoSearchInput): Promise<BrowserTaobaoSearchResult>;
  extract1688Offer(input: Browser1688OfferInput): Promise<Browser1688OfferResult | BrowserUnavailableResult>;
  extractTaobaoOffer(input: Browser1688OfferInput): Promise<Browser1688OfferResult | BrowserUnavailableResult>;
  refreshOfferStock(input: BrowserOfferStockInput): Promise<BrowserOfferStockResult | BrowserUnavailableResult>;
  extractSupplierSignals(input: BrowserSupplierSignalsInput): Promise<BrowserSupplierSignalsResult | BrowserUnavailableResult>;
}
