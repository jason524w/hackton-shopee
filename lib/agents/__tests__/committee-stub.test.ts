import { describe, expect, it } from "vitest";

import type { Opportunity } from "../../../contract/result";
import type { AgentContext } from "../contracts";
import { createNoopRisk } from "../contracts";
import { committeeAgent } from "../committee-stub";

function opp(id: string, overall: number, isPrimary = false): Opportunity {
  return {
    id,
    is_primary: isPrimary,
    name: id,
    direction: "",
    target_market: "Singapore",
    target_platform: "Shopee",
    source_price: 1,
    suggested_price: 2,
    minimum_viable_price: 1,
    gross_margin: 0.3,
    stock_status: "in_stock",
    fulfillment_days: 5,
    market_heat: "medium",
    risk_level: "low",
    decision: "Watch",
    decision_reason: `${id} reason`,
    scores: { profit: 0, demand: 0, compliance: 0, fulfillment: 0, packaging: 0, overall },
    margin: null,
    key_reasons: [],
  };
}

function ctxWith(opportunities: Opportunity[]): AgentContext {
  return {
    brief: {} as AgentContext["brief"],
    results: { opportunities },
    providers: {} as never,
    risk: createNoopRisk(),
  };
}

describe("committeeAgent (stub)", () => {
  it("ranks ranked_ids by scores.overall descending", async () => {
    const slice = await committeeAgent(
      ctxWith([opp("low", 40), opp("high", 90, true), opp("mid", 65)]),
    );

    expect(slice.committee?.ranked_ids).toEqual(["high", "mid", "low"]);
  });

  it("emits a tradeoff for every non-primary opportunity and none for the primary", async () => {
    const slice = await committeeAgent(
      ctxWith([opp("primary", 90, true), opp("alt1", 70), opp("alt2", 50)]),
    );

    const ids = slice.committee?.tradeoffs.map((t) => t.opportunity_id) ?? [];
    expect(ids).toEqual(["alt1", "alt2"]);
    expect(ids).not.toContain("primary");
  });
});
