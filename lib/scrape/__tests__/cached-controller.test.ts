import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  BrowserController,
  BrowserControllerSnapshot,
  BrowserRetrievalPolicy,
  BrowserRetrievalPurpose,
} from "../../providers/browser-retrieval/types";
import { FilesystemScrapeCache } from "../cache";
import { createCachedBrowserController } from "../cached-controller";

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

function snapshot(url: string): BrowserControllerSnapshot {
  return { url, title: "t", text: "rows", links: [], captured_at: "2026-06-10T00:00:00.000Z" };
}

function fakeController(): { controller: BrowserController; calls: () => number } {
  const capture = vi.fn(async (input: { url: string; purpose: BrowserRetrievalPurpose }) => snapshot(input.url));
  return { controller: { capture }, calls: () => capture.mock.calls.length };
}

describe("createCachedBrowserController", () => {
  let dir: string;
  let clock: number;
  let cache: FilesystemScrapeCache;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "cached-ctrl-"));
    clock = 1_000_000_000;
    cache = new FilesystemScrapeCache(dir, () => clock);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("captures on a miss, serves the cache (no re-capture) on a hit", async () => {
    const { controller, calls } = fakeController();
    const cached = createCachedBrowserController(controller, cache);
    const input = { url: "https://s.1688.com/x", purpose: "sourcing_1688_search" as const, policy: policy() };

    const first = await cached.capture(input);
    expect(first.from_cache).toBeUndefined();
    expect(calls()).toBe(1);

    const second = await cached.capture(input);
    expect(second.from_cache).toBe(true);
    expect(second.text).toBe("rows");
    expect(calls()).toBe(1); // served from cache — inner not called again
  });

  it("re-captures after the purpose TTL expires", async () => {
    const { controller, calls } = fakeController();
    const cached = createCachedBrowserController(controller, cache, {
      ttlByPurpose: { sourcing_1688_search: 10_000 },
    });
    const input = { url: "https://s.1688.com/x", purpose: "sourcing_1688_search" as const, policy: policy() };

    await cached.capture(input);
    clock += 10_001; // past TTL
    const after = await cached.capture(input);
    expect(after.from_cache).toBeUndefined();
    expect(calls()).toBe(2);
  });

  it("keys by purpose + url (different urls / purposes don't collide)", async () => {
    const { controller, calls } = fakeController();
    const cached = createCachedBrowserController(controller, cache);

    await cached.capture({ url: "https://s.1688.com/a", purpose: "sourcing_1688_search", policy: policy() });
    await cached.capture({ url: "https://s.1688.com/b", purpose: "sourcing_1688_search", policy: policy() });
    expect(calls()).toBe(2);
    // re-hit the first → cache
    const hit = await cached.capture({ url: "https://s.1688.com/a", purpose: "sourcing_1688_search", policy: policy() });
    expect(hit.from_cache).toBe(true);
    expect(calls()).toBe(2);
  });

  it("never caches login-gated captures (Seller Centre / session-dependent)", async () => {
    const { controller, calls } = fakeController();
    const cached = createCachedBrowserController(controller, cache);
    const input = {
      url: "https://seller.shopee.sg/portal",
      purpose: "market_shopee_ads" as const,
      policy: policy({ requires_human_login: true, allowed_domains: ["seller.shopee.sg"] }),
    };

    await cached.capture(input);
    const second = await cached.capture(input);
    expect(second.from_cache).toBeUndefined();
    expect(calls()).toBe(2); // re-captured, not cached
  });

  it("bypass option skips the cache", async () => {
    const { controller, calls } = fakeController();
    const cached = createCachedBrowserController(controller, cache, { bypass: true });
    const input = { url: "https://s.1688.com/x", purpose: "sourcing_1688_search" as const, policy: policy() };
    await cached.capture(input);
    await cached.capture(input);
    expect(calls()).toBe(2);
  });

  it("does not persist the screenshot path in the cached value", async () => {
    const capture = vi.fn(async () => ({ ...snapshot("https://s.1688.com/x"), screenshot_path: "/abs/shot.png" }));
    const cached = createCachedBrowserController({ capture }, cache);
    const input = { url: "https://s.1688.com/x", purpose: "sourcing_1688_search" as const, policy: policy() };
    await cached.capture(input);
    const hit = await cached.capture(input);
    expect(hit.from_cache).toBe(true);
    expect(hit.screenshot_path).toBeUndefined();
  });
});
