import { describe, expect, it } from "vitest";

import mock from "../../../contract/mock-result.json";
import {
  assertValidRunResult,
  ContractViolationError,
  validateRunResult,
} from "../validate-run-result";

// A deep clone of the known-good contract fixture; each test mutates one thing.
function validRunResult(): Record<string, unknown> {
  return structuredClone(mock) as Record<string, unknown>;
}

describe("validateRunResult", () => {
  it("accepts the canonical mock-result fixture", () => {
    expect(validateRunResult(validRunResult())).toEqual([]);
  });

  it("flags a missing required top-level field", () => {
    const result = validRunResult();
    delete result.committee;

    const errors = validateRunResult(result);
    expect(errors).toContainEqual(expect.stringContaining('missing required "committee"'));
  });

  it("flags agents that are out of canonical order", () => {
    const result = validRunResult();
    const agents = result.agents as unknown[];
    [agents[0], agents[1]] = [agents[1], agents[0]]; // swap market/sourcing

    const errors = validateRunResult(result);
    expect(errors).toContainEqual(expect.stringContaining("agents[]: expected exactly"));
  });

  it("flags an enum violation nested behind a $ref", () => {
    const result = validRunResult();
    (result.opportunities as { decision: string }[])[0].decision = "Maybe";

    const errors = validateRunResult(result);
    expect(errors).toContainEqual(expect.stringContaining("not in enum"));
  });

  it("flags a wrong primitive type deep inside nested $refs", () => {
    const result = validRunResult();
    // opportunity → scores → profit must be a number
    (result.opportunities as { scores: Record<string, unknown> }[])[0].scores.profit = "high";

    const errors = validateRunResult(result);
    expect(errors).toContainEqual(
      expect.stringContaining("opportunities[0].scores.profit: expected number"),
    );
  });
});

describe("assertValidRunResult", () => {
  it("does not throw for a valid RunResult", () => {
    expect(() => assertValidRunResult(validRunResult())).not.toThrow();
  });

  it("throws ContractViolationError carrying the collected errors", () => {
    const result = validRunResult();
    delete result.committee;

    try {
      assertValidRunResult(result);
      throw new Error("expected assertValidRunResult to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ContractViolationError);
      expect((error as ContractViolationError).errors).toContainEqual(
        expect.stringContaining('missing required "committee"'),
      );
    }
  });
});
