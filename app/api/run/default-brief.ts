import type { Brief } from "../../../contract/result";

// Demo-default brief (Mini Desk Vacuum · Shopee · Singapore). Inlined as a literal —
// runtime code must not import contract/fixtures/* (single-real-path rule).
export const DEFAULT_BRIEF: Brief = {
  target_market: "Singapore",
  target_platform: "Shopee",
  seller_type: "individual_dropshipper",
  product_intent: "mini desk vacuum",
  category: "home_appliances_small",
  budget: 500,
  target_margin: 0.25,
  max_fulfillment_days: 12,
  risk_appetite: "balanced",
  language: "en",
};
