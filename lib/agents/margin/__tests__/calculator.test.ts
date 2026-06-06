import { describe, expect, it } from "vitest";
import type { CostLine } from "../../../../contract/result";
import { BASE_ASSUMPTIONS, LOW_ASSUMPTIONS, HIGH_ASSUMPTIONS } from "../assumptions";
import { computeMargin, computeScenario, minimumViablePrice } from "../calculator";

// Mini Desk Vacuum demo fixture: suggested price from market/sourcing, target from brief.
const SELLING_PRICE = 11.9;
const TARGET_MARGIN = 0.25;

function sumWaterfall(lines: CostLine[]): number {
  // revenue positive, costs negative; exclude the explicit "net" line.
  return lines
    .filter((l) => l.type !== "net")
    .reduce((acc, l) => acc + l.amount, 0);
}

describe("margin calculator — deterministic, code does all arithmetic", () => {
  it("base scenario lands ~28-29% for the vacuum mock assumptions", () => {
    const { margin } = computeScenario(BASE_ASSUMPTIONS, SELLING_PRICE);
    expect(margin.net_margin).toBeGreaterThan(0.27);
    expect(margin.net_margin).toBeLessThan(0.31);
  });

  it("pessimistic (low) scenario collapses to ~12% — the demo climax", () => {
    const { margin } = computeScenario(LOW_ASSUMPTIONS, SELLING_PRICE);
    expect(margin.net_margin).toBeGreaterThan(0.1);
    expect(margin.net_margin).toBeLessThan(0.14);
    // load-bearing: low must fall below target so committee caps to Watch
    expect(margin.net_margin).toBeLessThan(TARGET_MARGIN);
  });

  it("optimistic (high) scenario reaches ~37-38%", () => {
    const { margin } = computeScenario(HIGH_ASSUMPTIONS, SELLING_PRICE);
    expect(margin.net_margin).toBeGreaterThan(0.35);
    expect(margin.net_margin).toBeLessThan(0.4);
  });

  it("cost breakdown sums to net profit within rounding tolerance", () => {
    const { margin, lines } = computeScenario(BASE_ASSUMPTIONS, SELLING_PRICE);
    expect(sumWaterfall(lines)).toBeCloseTo(margin.net_profit, 2);
    const net = lines.find((l) => l.type === "net");
    expect(net?.amount).toBeCloseTo(margin.net_profit, 2);
  });

  it("every cost line has label, amount, and type", () => {
    const { lines } = computeScenario(BASE_ASSUMPTIONS, SELLING_PRICE);
    for (const l of lines) {
      expect(l.label).toBeTruthy();
      expect(typeof l.amount).toBe("number");
      expect(["revenue", "cost", "net"]).toContain(l.type);
    }
    expect(lines[0]?.type).toBe("revenue");
  });

  it("minimum viable price is the price that exactly hits target margin", () => {
    const mvp = minimumViablePrice(BASE_ASSUMPTIONS, TARGET_MARGIN);
    expect(mvp).toBeGreaterThan(10.5);
    expect(mvp).toBeLessThan(11.5);
    // self-check: selling at mvp (a real cents price) yields ~target margin
    const { margin } = computeScenario(BASE_ASSUMPTIONS, mvp);
    expect(margin.net_margin).toBeCloseTo(TARGET_MARGIN, 2);
  });

  it("computeMargin assembles the contract MarginDetail + mvp", () => {
    const result = computeMargin({
      sellingPrice: SELLING_PRICE,
      base: BASE_ASSUMPTIONS,
      low: LOW_ASSUMPTIONS,
      high: HIGH_ASSUMPTIONS,
      targetMargin: TARGET_MARGIN,
    });
    expect(result.low.net_margin).toBeLessThan(result.base.net_margin);
    expect(result.base.net_margin).toBeLessThan(result.high.net_margin);
    expect(result.minimum_viable_price).toBeGreaterThan(0);
    expect(result.cost_breakdown.length).toBeGreaterThan(5);
  });
});
