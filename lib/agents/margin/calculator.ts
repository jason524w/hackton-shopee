// Deterministic margin calculator. Pure functions, no IO, no LLM.
// All money fields in RunResult come from here. See docs/design/margin-risk.md §3.

import type { CostLine, MarginDetail } from "../../../contract/result";
import type { MarginAssumptions } from "./assumptions";

export interface ScenarioMargin {
  net_profit: number;
  net_margin: number;
}

export interface ScenarioResult {
  margin: ScenarioMargin;
  lines: CostLine[];
}

/** Round to cents to keep the waterfall and reported figures consistent. */
function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function percentRate(a: MarginAssumptions): number {
  return a.platform_fee_rate + a.payment_fee_rate + a.return_reserve_rate + a.damage_reserve_rate;
}

/** Per-unit fixed costs in SGD (price-independent), including import GST on CIF. */
function fixedCosts(a: MarginAssumptions): {
  source: number;
  intl: number;
  importGst: number;
  total: number;
} {
  const source = a.source_price_cny * a.fx_cny_sgd;
  const intl = a.intl_shipping_sgd;
  const cif = source + intl;
  const importGst = a.import_gst_rate * cif;
  const total = source + intl + a.local_delivery_sgd + a.packaging_sgd + a.ai_ops_sgd + importGst;
  return { source, intl, importGst, total };
}

/** Compute one scenario: net profit/margin + the cost-breakdown waterfall. */
export function computeScenario(a: MarginAssumptions, sellingPrice: number): ScenarioResult {
  const fixed = fixedCosts(a);

  // Revenue + cost lines, each rounded to cents for display.
  const flow: CostLine[] = [
    { label: "Selling price", amount: r2(sellingPrice), type: "revenue" },
    { label: "Source price", amount: -r2(fixed.source), type: "cost" },
    { label: "Intl shipping", amount: -r2(fixed.intl), type: "cost" },
    { label: "Local delivery", amount: -r2(a.local_delivery_sgd), type: "cost" },
    { label: `Platform fee (${pct(a.platform_fee_rate)})`, amount: -r2(sellingPrice * a.platform_fee_rate), type: "cost" },
    { label: `Payment fee (${pct(a.payment_fee_rate)})`, amount: -r2(sellingPrice * a.payment_fee_rate), type: "cost" },
    { label: `Import GST (${pct(a.import_gst_rate)} CIF)`, amount: -r2(fixed.importGst), type: "cost" },
    { label: `Return reserve (${pct(a.return_reserve_rate)})`, amount: -r2(sellingPrice * a.return_reserve_rate), type: "cost" },
    { label: `Damage reserve (${pct(a.damage_reserve_rate)})`, amount: -r2(sellingPrice * a.damage_reserve_rate), type: "cost" },
    { label: "Packaging", amount: -r2(a.packaging_sgd), type: "cost" },
    { label: "AI ops", amount: -r2(a.ai_ops_sgd), type: "cost" },
  ];

  // Net is the sum of the displayed lines, so the waterfall always adds up
  // exactly (no sum-of-rounded != rounded-sum drift).
  const netProfit = r2(flow.reduce((acc, l) => acc + l.amount, 0));
  const lines: CostLine[] = [...flow, { label: "Net profit", amount: netProfit, type: "net" }];

  return {
    margin: { net_profit: netProfit, net_margin: netProfit / sellingPrice },
    lines,
  };
}

/** Price at which net_margin == targetMargin under the given assumptions. */
export function minimumViablePrice(a: MarginAssumptions, targetMargin: number): number {
  const fixed = fixedCosts(a);
  // margin = (1 - pct) - fixed/P = target  =>  P = fixed / ((1 - pct) - target)
  const denom = 1 - percentRate(a) - targetMargin;
  if (denom <= 0) return Number.POSITIVE_INFINITY; // target unreachable at any price
  return r2(fixed.total / denom);
}

export interface ComputeMarginInput {
  sellingPrice: number;
  base: MarginAssumptions;
  low: MarginAssumptions;
  high: MarginAssumptions;
  targetMargin: number;
}

/** Assemble the contract MarginDetail (+ minimum viable price) for an opportunity. */
export function computeMargin(input: ComputeMarginInput): MarginDetail & { minimum_viable_price: number } {
  const base = computeScenario(input.base, input.sellingPrice);
  const low = computeScenario(input.low, input.sellingPrice);
  const high = computeScenario(input.high, input.sellingPrice);
  return {
    base: base.margin,
    low: low.margin,
    high: high.margin,
    cost_breakdown: base.lines,
    minimum_viable_price: minimumViablePrice(input.base, input.targetMargin),
  };
}

function pct(rate: number): string {
  return `${Math.round(rate * 1000) / 10}%`;
}
