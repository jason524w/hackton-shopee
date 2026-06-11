import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemScrapeCache, scrapeCacheKey } from "../cache";

describe("scrapeCacheKey", () => {
  it("normalizes whitespace and case so trivially-different targets share a slot", () => {
    expect(scrapeCacheKey("sourcing_1688_search", "  Mini  Desk Vacuum ")).toBe(
      scrapeCacheKey("sourcing_1688_search", "mini desk vacuum"),
    );
  });
  it("keys differ by purpose", () => {
    expect(scrapeCacheKey("market_shopee_search", "x")).not.toBe(scrapeCacheKey("sourcing_1688_search", "x"));
  });
});

describe("FilesystemScrapeCache", () => {
  let dir: string;
  let clock: number;
  let cache: FilesystemScrapeCache;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "scrape-cache-"));
    clock = 1_000_000_000;
    cache = new FilesystemScrapeCache(dir, () => clock);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("stores and returns an unexpired entry", async () => {
    await cache.set("k1", { rows: [1, 2, 3] }, 60_000);
    const got = await cache.get<{ rows: number[] }>("k1");
    expect(got?.value.rows).toEqual([1, 2, 3]);
    expect(got?.captured_at).toBeTruthy();
    expect(got?.expires_at).toBeTruthy();
  });

  it("returns undefined on a miss", async () => {
    expect(await cache.get("nope")).toBeUndefined();
  });

  it("treats an expired entry as a miss and removes it", async () => {
    await cache.set("k1", { v: 1 }, 10_000);
    clock += 10_001; // past TTL
    expect(await cache.get("k1")).toBeUndefined();
    // a fresh set after expiry works
    await cache.set("k1", { v: 2 }, 10_000);
    expect((await cache.get<{ v: number }>("k1"))?.value.v).toBe(2);
  });

  it("delete removes an entry", async () => {
    await cache.set("k1", { v: 1 }, 60_000);
    await cache.delete("k1");
    expect(await cache.get("k1")).toBeUndefined();
  });

  it("keys are isolated (no cross-key bleed)", async () => {
    await cache.set("a", { v: "A" }, 60_000);
    await cache.set("b", { v: "B" }, 60_000);
    expect((await cache.get<{ v: string }>("a"))?.value.v).toBe("A");
    expect((await cache.get<{ v: string }>("b"))?.value.v).toBe("B");
  });

  it("prune removes only expired entries", async () => {
    await cache.set("fresh", { v: 1 }, 60_000);
    await cache.set("stale", { v: 2 }, 5_000);
    clock += 10_000; // stale expired, fresh still valid
    const removed = await cache.prune();
    expect(removed).toBe(1);
    expect(await cache.get("stale")).toBeUndefined();
    expect((await cache.get<{ v: number }>("fresh"))?.value.v).toBe(1);
  });
});
