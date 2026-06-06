import { describe, expect, it } from "vitest";
import mock from "../../../../contract/mock-result.json";
import type { Brief, Opportunity } from "../../../../contract/result";
import { COMMITTEE_WEIGHTS, computeOverall } from "../weights";
import { baseDecision, fallbackDecision, type FallbackSignals } from "../gates";

const brief = mock.brief as Brief;
const opp = (id: string) => mock.opportunities.find((o) => o.id === id) as unknown as Opportunity;
const cable = opp("opp_cable_organizer");
const vacuum = opp("opp_desk_vacuum");
const dehum = opp("opp_mini_dehumidifier");

const cleanSig: FallbackSignals = { checkpoints: [], missingFields: false, imagesRejected: false };

describe("weights", () => {
  it("weights sum to 1.0", () => {
    const sum = Object.values(COMMITTEE_WEIGHTS).reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
  it("computeOverall reproduces the weighted score", () => {
    expect(computeOverall(cable.scores)).toBe(71); // 61·.3+64·.25+88·.2+80·.15+70·.1 = 70.9
    expect(computeOverall(vacuum.scores)).toBe(70); // 69.8
    expect(computeOverall(dehum.scores)).toBe(60); // 59.95
  });
});

describe("baseDecision (score only)", () => {
  it("maps overall to Go/Watch/Reject", () => {
    expect(baseDecision(71)).toBe("Go");
    expect(baseDecision(50)).toBe("Watch");
    expect(baseDecision(49)).toBe("Reject");
  });
});

describe("fallbackDecision (deterministic safety net = demo outcome)", () => {
  it("cable organizer: low risk, in limit -> Go", () => {
    expect(fallbackDecision(cable, brief, cleanSig).decision).toBe("Go");
  });

  it("desk vacuum: base would be Go, margin.low < target caps to Watch", () => {
    const { decision, reasons } = fallbackDecision(vacuum, brief, cleanSig);
    expect(decision).toBe("Watch");
    expect(reasons.join("")).toMatch(/利润|敏感|悲观/);
  });

  it("dehumidifier: high risk -> Reject (overrides its Watch base)", () => {
    const { decision } = fallbackDecision(dehum, brief, cleanSig);
    expect(decision).toBe("Reject");
  });

  it("hard_block checkpoint forces Reject even on a Go-scored opportunity", () => {
    const sig: FallbackSignals = {
      checkpoints: [{ stage: "listing", risk_level: "high", human_review_required: true, hard_block: true, warnings: [], evidence: [], flags: [] }],
      missingFields: false,
      imagesRejected: false,
    };
    expect(fallbackDecision({ ...cable, is_primary: true }, brief, sig).decision).toBe("Reject");
  });

  it("human_review is NOT a gate (does not by itself change the verdict)", () => {
    // cable with human_review true but otherwise clean stays Go
    const sig: FallbackSignals = {
      checkpoints: [{ stage: "listing", risk_level: "low", human_review_required: true, hard_block: false, warnings: [], evidence: [], flags: [] }],
      missingFields: false,
      imagesRejected: false,
    };
    expect(fallbackDecision(cable, brief, sig).decision).toBe("Go");
  });
});
