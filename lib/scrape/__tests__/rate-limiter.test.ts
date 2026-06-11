import { describe, expect, it } from "vitest";
import { createTokenBucketRateLimiter } from "../rate-limiter";

describe("token-bucket rate limiter", () => {
  it("allows up to capacity immediately, then denies", () => {
    let clock = 0;
    const rl = createTokenBucketRateLimiter({ capacity: 3, refillPerSec: 1, now: () => clock });
    expect(rl.tryAcquire("k")).toBe(true);
    expect(rl.tryAcquire("k")).toBe(true);
    expect(rl.tryAcquire("k")).toBe(true);
    expect(rl.tryAcquire("k")).toBe(false); // empty
  });

  it("refills over time", () => {
    let clock = 0;
    const rl = createTokenBucketRateLimiter({ capacity: 2, refillPerSec: 2, now: () => clock });
    rl.tryAcquire("k");
    rl.tryAcquire("k");
    expect(rl.tryAcquire("k")).toBe(false);
    clock += 500; // 0.5s * 2/s = 1 token
    expect(rl.available("k")).toBe(1);
    expect(rl.tryAcquire("k")).toBe(true);
  });

  it("caps refill at capacity (no overflow)", () => {
    let clock = 0;
    const rl = createTokenBucketRateLimiter({ capacity: 2, refillPerSec: 10, now: () => clock });
    rl.tryAcquire("k");
    rl.tryAcquire("k");
    clock += 10_000; // would add 100 tokens, but capped at 2
    expect(rl.available("k")).toBe(2);
  });

  it("keys are independent", () => {
    let clock = 0;
    const rl = createTokenBucketRateLimiter({ capacity: 1, refillPerSec: 1, now: () => clock });
    expect(rl.tryAcquire("a")).toBe(true);
    expect(rl.tryAcquire("a")).toBe(false);
    expect(rl.tryAcquire("b")).toBe(true); // b has its own bucket
  });

  it("acquire() waits for a refill using injected sleep that advances the clock", async () => {
    let clock = 0;
    const rl = createTokenBucketRateLimiter({
      capacity: 1,
      refillPerSec: 1,
      now: () => clock,
      sleep: async (ms) => {
        clock += ms; // simulate time passing
      },
    });
    rl.tryAcquire("k"); // drain
    const start = clock;
    await rl.acquire("k"); // must wait ~1000ms for one token
    expect(clock - start).toBeGreaterThanOrEqual(1000);
  });

  it("acquire() throws when there is no refill and the bucket is empty", async () => {
    const rl = createTokenBucketRateLimiter({ capacity: 1, refillPerSec: 0 });
    rl.tryAcquire("k");
    await expect(rl.acquire("k")).rejects.toThrow(/no refill/);
  });
});
