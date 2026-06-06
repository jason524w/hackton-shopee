// Documented cost assumptions for the deterministic margin calculator.
// See docs/design/margin-risk.md §3. Code does all arithmetic; the LLM never
// invents or alters these numbers. low/base/high vary ONLY the three drivers
// decided in the design: return rate, international shipping, and FX.

export interface MarginAssumptions {
  // FX + sourcing (FX band drives source_price)
  fx_cny_sgd: number; // CNY -> SGD rate
  source_price_cny: number; // 1688 unit price in CNY

  // logistics (SGD)
  intl_shipping_sgd: number;
  local_delivery_sgd: number;

  // fixed per-unit operating costs (SGD)
  packaging_sgd: number;
  ai_ops_sgd: number;

  // percentage-of-price rates (0..1)
  platform_fee_rate: number;
  payment_fee_rate: number;
  return_reserve_rate: number;
  damage_reserve_rate: number;

  // import GST charged on CIF (source + international freight), 0..1
  import_gst_rate: number;
}

// Fixed across all three scenarios (only the three drivers move).
const FIXED = {
  source_price_cny: 15.8, // ~SGD 2.90 at base FX
  local_delivery_sgd: 1.2,
  packaging_sgd: 0.3,
  ai_ops_sgd: 0.1,
  platform_fee_rate: 0.08, // Shopee SG small-appliance category
  payment_fee_rate: 0.02,
  import_gst_rate: 0.09, // SG import GST on low-value goods
} as const;

export const BASE_ASSUMPTIONS: MarginAssumptions = {
  ...FIXED,
  fx_cny_sgd: 0.184,
  intl_shipping_sgd: 1.5,
  return_reserve_rate: 0.05,
  damage_reserve_rate: 0.02,
};

// Pessimistic: CNY strengthens, freight spikes, returns/damage climb (electrical).
export const LOW_ASSUMPTIONS: MarginAssumptions = {
  ...FIXED,
  fx_cny_sgd: 0.205,
  intl_shipping_sgd: 1.9,
  return_reserve_rate: 0.13,
  damage_reserve_rate: 0.04,
};

// Optimistic: favourable FX, cheaper freight, low returns.
export const HIGH_ASSUMPTIONS: MarginAssumptions = {
  ...FIXED,
  fx_cny_sgd: 0.168,
  intl_shipping_sgd: 1.3,
  return_reserve_rate: 0.02,
  damage_reserve_rate: 0.01,
};
