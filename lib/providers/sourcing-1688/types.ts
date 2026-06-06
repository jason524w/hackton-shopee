import type { ProviderResultMeta } from "../shared";

export interface SourcingSearchOffersInput {
  query: string;
  limit?: number;
}

export interface SourcingOfferSummary {
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

export interface SourcingSearchOffersResult extends ProviderResultMeta {
  query: string;
  offers: SourcingOfferSummary[];
}

export interface SourcingOfferDetailInput {
  offerId: string;
}

export interface SourcingOfferDetail extends SourcingOfferSummary {
  sku_options: Array<{ name: string; options: string[] }>;
  package_weight_g: number;
  package_dimensions_cm: { length: number; width: number; height: number };
  supplier_risk_notes: string[];
}

export interface SourcingOfferDetailResult extends ProviderResultMeta {
  offer: SourcingOfferDetail;
}

export interface Sourcing1688Provider {
  searchOffers(input: SourcingSearchOffersInput): Promise<SourcingSearchOffersResult>;
  getOfferDetail(input: SourcingOfferDetailInput): Promise<SourcingOfferDetailResult>;
}
