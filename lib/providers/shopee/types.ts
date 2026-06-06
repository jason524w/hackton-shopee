import type { ProviderResultMeta } from "../shared";

export interface ShopeeSearchProductsInput {
  query: string;
  market: string;
  category?: string;
  limit?: number;
}

export interface ShopeeProductSummary {
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

export interface ShopeeSearchProductsResult extends ProviderResultMeta {
  query: string;
  market: string;
  category?: string;
  products: ShopeeProductSummary[];
  competitor_count: number;
  price_band: { low: number; high: number; median: number };
}

export interface ShopeeProductDetailInput {
  itemId: string;
}

export interface ShopeeProductDetail extends ShopeeProductSummary {
  description: string;
  bullet_points: string[];
  attributes: Record<string, string>;
  logistics: { weight_g: number; length_cm: number; width_cm: number; height_cm: number };
  seller_location: string;
  style_notes: string[];
}

export interface ShopeeProductDetailResult extends ProviderResultMeta {
  product: ShopeeProductDetail;
}

export interface ShopeeCategoryAttributesInput {
  categoryId: number;
}

export interface ShopeeCategoryAttribute {
  name: string;
  required: boolean;
  examples?: string[];
}

export interface ShopeeCategoryAttributesResult extends ProviderResultMeta {
  category_id: number;
  category_name: string;
  attributes: ShopeeCategoryAttribute[];
}

export interface ShopeePolicyRulesInput {
  market: string;
}

export interface ShopeePolicyRule {
  id: string;
  title: string;
  severity: "info" | "warning" | "hard_block";
  applies_to: string[];
  guidance: string;
  source_url?: string;
}

export interface ShopeePolicyRulesResult extends ProviderResultMeta {
  market: string;
  rules: ShopeePolicyRule[];
}

export interface ShopeeProvider {
  searchProducts(input: ShopeeSearchProductsInput): Promise<ShopeeSearchProductsResult>;
  getProductDetail(input: ShopeeProductDetailInput): Promise<ShopeeProductDetailResult>;
  getCategoryAttributes(input: ShopeeCategoryAttributesInput): Promise<ShopeeCategoryAttributesResult>;
  getPolicyRules(input: ShopeePolicyRulesInput): Promise<ShopeePolicyRulesResult>;
}
