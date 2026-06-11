import { describe, expect, it } from "vitest";
import { createCircuitBreaker } from "../circuit-breaker";

describe("circuit breaker", () => {
  it("starts closed and allows requests", () => {
    const cb = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 1000 });
    expect(cb.state("p")).toBe("closed");
    expect(cb.canRequest("p")).toBe(true);
  });

  it("trips open after the failure threshold", () => {
    let clock = 0;
    const cb = createCircuitBreaker({ failureThreshold: 3, cooldownMs: 1000, now: () => clock });
    cb.onFailure("p");
    cb.onFailure("p");
    expect(cb.state("p")).toBe("closed");
    cb.onFailure("p"); // 3rd → open
    expect(cb.state("p")).toBe("open");
    expect(cb.canRequest("p")).toBe(false);
  });

  it("a success resets the failure count", () => {
    const cb = createCircuitBreaker({ failureThreshold: 2, cooldownMs: 1000 });
    cb.onFailure("p");
    cb.onSuccess("p");
    cb.onFailure("p");
    expect(cb.state("p")).toBe("closed"); // count was reset, so 1 failure != threshold
  });

  it("moves to half-open after cooldown, and closes on a successful trial", () => {
    let clock = 0;
    const cb = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => clock });
    cb.onFailure("p"); // open
    expect(cb.canRequest("p")).toBe(false);
    clock += 1000;
    expect(cb.canRequest("p")).toBe(true); // half-open trial allowed
    expect(cb.state("p")).toBe("half_open");
    cb.onSuccess("p");
    expect(cb.state("p")).toBe("closed");
  });

  it("a failed half-open trial re-opens and restarts the cooldown", () => {
    let clock = 0;
    const cb = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1000, now: () => clock });
    cb.onFailure("p"); // open
    clock += 1000;
    expect(cb.canRequest("p")).toBe(true); // half-open
    cb.onFailure("p"); // trial fails → re-open
    expect(cb.state("p")).toBe("open");
    expect(cb.canRequest("p")).toBe(false);
    clock += 999;
    expect(cb.canRequest("p")).toBe(false); // cooldown restarted
    clock += 1;
    expect(cb.canRequest("p")).toBe(true);
  });

  it("keys are independent", () => {
    const cb = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1000 });
    cb.onFailure("a");
    expect(cb.canRequest("a")).toBe(false);
    expect(cb.canRequest("b")).toBe(true);
  });
});
