import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { BrowserRetrievalPolicy } from "../../providers/browser-retrieval/types";
import { createCircuitBreaker } from "../circuit-breaker";
import type { ScrapeEngine, ScrapeEngineResult } from "../engine";
import { createHandoffQueue } from "../handoff";
import {
  createManagedBrowserController,
  ScrapeChallengeError,
  ScrapeCircuitOpenError,
  ScrapeNoProxyError,
} from "../managed-controller";
import { createProxyPool } from "../proxy-pool";
import { createTokenBucketRateLimiter } from "../rate-limiter";
import { InMemorySessionStore } from "../session-store";

function policy(overrides: Partial<BrowserRetrievalPolicy> = {}): BrowserRetrievalPolicy {
  return {
    allowed_domains: ["1688.com"],
    max_steps: 4,
    requires_human_login: false,
    capture_screenshot: false,
    redact_sensitive: true,
    ...overrides,
  };
}

function engineReturning(result: Partial<ScrapeEngineResult>): { engine: ScrapeEngine; calls: () => unknown[][] } {
  const capturePage = vi.fn(async (input) => ({
    url: input.url,
    title: "t",
    text: "rows",
    links: [],
    ...result,
  }));
  return { engine: { capturePage }, calls: () => capturePage.mock.calls };
}

const URL_1688 = "https://s.1688.com/offer_search.htm?keywords=x";

describe("managed browser controller", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "managed-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("captures successfully and maps the engine result to a snapshot", async () => {
    const { engine } = engineReturning({ text: "vacuum rows", scan: { steps: 3, reached_end: true } });
    const controller = createManagedBrowserController({ engine, screenshotDir: dir });
    const snap = await controller.capture({ url: URL_1688, purpose: "sourcing_1688_search", policy: policy() });
    expect(snap.text).toBe("vacuum rows");
    expect(snap.scan).toEqual({ steps: 3, reached_end: true });
    expect(snap.captured_at).toBeTruthy();
  });

  it("passes proxy + restored session into the engine and refreshes the session on success", async () => {
    const sessionStore = new InMemorySessionStore();
    await sessionStore.save("1688", { cookies: [{ name: "old" }], user_agent: "UA-1" });
    const proxyPool = createProxyPool([{ id: "p1", url: "http://p1" }]);
    const { engine, calls } = engineReturning({ cookies: [{ name: "new" }] });

    const controller = createManagedBrowserController({ engine, proxyPool, sessionStore, screenshotDir: dir });
    await controller.capture({ url: URL_1688, purpose: "sourcing_1688_search", policy: policy() });

    const passed = calls()[0][0] as { proxyUrl?: string; session?: { user_agent?: string } };
    expect(passed.proxyUrl).toBe("http://p1");
    expect(passed.session?.user_agent).toBe("UA-1");
    // session refreshed with the new cookies
    expect((await sessionStore.get("1688"))?.cookies).toEqual([{ name: "new" }]);
  });

  it("on a challenge: queues a handoff, trips the breaker, and throws (no bypass)", async () => {
    const handoff = createHandoffQueue({ makeId: () => "h1" });
    const circuitBreaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 1000 });
    const { engine } = engineReturning({ challenge: true });
    const controller = createManagedBrowserController({ engine, handoff, circuitBreaker, screenshotDir: dir });

    await expect(
      controller.capture({ url: URL_1688, purpose: "sourcing_1688_search", policy: policy() }),
    ).rejects.toBeInstanceOf(ScrapeChallengeError);

    expect((await handoff.list("pending")).length).toBe(1);
    expect(circuitBreaker.canRequest("1688")).toBe(false); // tripped
  });

  it("short-circuits when the breaker is open", async () => {
    const circuitBreaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 10_000 });
    circuitBreaker.onFailure("1688"); // open it
    const { engine, calls } = engineReturning({});
    const controller = createManagedBrowserController({ engine, circuitBreaker, screenshotDir: dir });

    await expect(
      controller.capture({ url: URL_1688, purpose: "sourcing_1688_search", policy: policy() }),
    ).rejects.toBeInstanceOf(ScrapeCircuitOpenError);
    expect(calls().length).toBe(0); // engine never invoked
  });

  it("throws (without leaking origin IP) when the proxy pool is exhausted", async () => {
    let clock = 0;
    const proxyPool = createProxyPool([{ id: "p1", url: "http://p1" }], { cooldownMs: 10_000, now: () => clock });
    proxyPool.report("p1", false); // park the only proxy
    const { engine, calls } = engineReturning({});
    const controller = createManagedBrowserController({ engine, proxyPool, screenshotDir: dir });

    await expect(
      controller.capture({ url: URL_1688, purpose: "sourcing_1688_search", policy: policy() }),
    ).rejects.toBeInstanceOf(ScrapeNoProxyError);
    expect(calls().length).toBe(0);
  });

  it("reports proxy failure and trips breaker when the engine throws", async () => {
    const proxyPool = createProxyPool([{ id: "p1", url: "http://p1" }], { cooldownMs: 10_000 });
    const circuitBreaker = createCircuitBreaker({ failureThreshold: 1, cooldownMs: 10_000 });
    const engine: ScrapeEngine = {
      capturePage: async () => {
        throw new Error("navigation failed");
      },
    };
    const controller = createManagedBrowserController({ engine, proxyPool, circuitBreaker, screenshotDir: dir });

    await expect(
      controller.capture({ url: URL_1688, purpose: "sourcing_1688_search", policy: policy() }),
    ).rejects.toThrow(/navigation failed/);
    expect(proxyPool.healthyCount()).toBe(0); // p1 parked
    expect(circuitBreaker.canRequest("1688")).toBe(false);
  });

  it("rate-limits per platform (acquire is awaited before capture)", async () => {
    const order: string[] = [];
    const rateLimiter = createTokenBucketRateLimiter({ capacity: 1, refillPerSec: 1000 });
    const baseAcquire = rateLimiter.acquire.bind(rateLimiter);
    rateLimiter.acquire = async (k: string) => {
      order.push("acquire");
      return baseAcquire(k);
    };
    const capturePage = vi.fn(async (input: { url: string }) => {
      order.push("capture");
      return { url: input.url, title: "t", text: "rows", links: [] };
    });
    const controller = createManagedBrowserController({ engine: { capturePage }, rateLimiter, screenshotDir: dir });
    await controller.capture({ url: URL_1688, purpose: "sourcing_1688_search", policy: policy() });
    expect(order).toEqual(["acquire", "capture"]);
  });
});
