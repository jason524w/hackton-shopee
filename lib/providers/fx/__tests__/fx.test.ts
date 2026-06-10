import { describe, expect, it, vi } from "vitest";
import { createLiveFxProvider, createSeedFxProvider, type FxFetcher } from "../index";

function okResponse(body: unknown): ReturnType<FxFetcher> {
  return Promise.resolve({ ok: true, status: 200, json: async () => body });
}

const ER_API_BODY = {
  result: "success",
  time_last_update_unix: Math.floor(Date.now() / 1000),
  rates: { SGD: 0.1884, USD: 0.1392, CNY: 1 },
};

describe("live FX provider", () => {
  it("converts using a live rates API and reports live mode", async () => {
    const fetcher = vi.fn<FxFetcher>(() => okResponse(ER_API_BODY));
    const provider = createLiveFxProvider({ fetcher, baseUrl: "https://fx.test/{base}" });

    const result = await provider.convert({ amount: 100, from: "cny", to: "sgd" });

    expect(fetcher).toHaveBeenCalledWith("https://fx.test/CNY"); // currency codes normalized to upper-case
    expect(result.from).toBe("CNY");
    expect(result.to).toBe("SGD");
    expect(result.rate).toBe(0.1884);
    expect(result.converted_amount).toBe(18.84);
    expect(result.source.mode).toBe("live");
    expect(result.source.source_url).toBe("https://fx.test/CNY");
  });

  it("caches rates per base within the TTL (one fetch for repeated/cross conversions)", async () => {
    let clock = 1_000_000;
    const fetcher = vi.fn<FxFetcher>(() => okResponse(ER_API_BODY));
    const provider = createLiveFxProvider({
      fetcher,
      baseUrl: "https://fx.test/{base}",
      cacheTtlMs: 60_000,
      now: () => clock,
    });

    await provider.convert({ amount: 10, from: "CNY", to: "SGD" });
    clock += 5_000; // still within TTL
    const second = await provider.convert({ amount: 10, from: "CNY", to: "USD" });

    expect(fetcher).toHaveBeenCalledTimes(1); // base CNY fetched once, reused for the cross conversion
    expect(second.source.mode).toBe("live"); // cached serve still reports live-sourced data
    expect(second.rate).toBe(0.1392);
  });

  it("refetches after the TTL expires", async () => {
    let clock = 1_000_000;
    const fetcher = vi.fn<FxFetcher>(() => okResponse(ER_API_BODY));
    const provider = createLiveFxProvider({
      fetcher,
      baseUrl: "https://fx.test/{base}",
      cacheTtlMs: 10_000,
      now: () => clock,
    });

    await provider.convert({ amount: 1, from: "CNY", to: "SGD" });
    clock += 20_000; // past TTL
    await provider.convert({ amount: 1, from: "CNY", to: "SGD" });

    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("serves last-good cached rates when a refetch fails (no hard failure mid-run)", async () => {
    let clock = 1_000_000;
    let calls = 0;
    const fetcher = vi.fn<FxFetcher>(() => {
      calls += 1;
      if (calls === 1) return okResponse(ER_API_BODY);
      return Promise.reject(new Error("network down"));
    });
    const provider = createLiveFxProvider({ fetcher, baseUrl: "https://fx.test/{base}", cacheTtlMs: 1, now: () => clock });

    await provider.convert({ amount: 1, from: "CNY", to: "SGD" });
    clock += 1000; // force TTL expiry → refetch attempt fails
    const result = await provider.convert({ amount: 1, from: "CNY", to: "SGD" });

    expect(result.rate).toBe(0.1884); // last-good rate served despite the failed refetch
  });

  it("throws (no seed fallback) when the first fetch fails", async () => {
    const fetcher = vi.fn<FxFetcher>(() => Promise.reject(new Error("boom")));
    const provider = createLiveFxProvider({ fetcher, baseUrl: "https://fx.test/{base}" });

    await expect(provider.convert({ amount: 1, from: "CNY", to: "SGD" })).rejects.toThrow(/FX live fetch failed/);
  });

  it("returns rate 1 for same-currency conversion without fetching", async () => {
    const fetcher = vi.fn<FxFetcher>(() => okResponse(ER_API_BODY));
    const provider = createLiveFxProvider({ fetcher, baseUrl: "https://fx.test/{base}" });

    const result = await provider.convert({ amount: 42, from: "SGD", to: "SGD" });

    expect(fetcher).not.toHaveBeenCalled();
    expect(result.rate).toBe(1);
    expect(result.converted_amount).toBe(42);
  });

  it("throws when the target currency is missing from the source response", async () => {
    const fetcher = vi.fn<FxFetcher>(() => okResponse({ result: "success", rates: { USD: 0.14 } }));
    const provider = createLiveFxProvider({ fetcher, baseUrl: "https://fx.test/{base}" });

    await expect(provider.convert({ amount: 1, from: "CNY", to: "SGD" })).rejects.toThrow(/unavailable/);
  });
});

describe("seed FX provider (still available for FX_PROVIDER=seed)", () => {
  it("converts CNY->SGD from the seed file", async () => {
    const result = await createSeedFxProvider().convert({ amount: 100, from: "CNY", to: "SGD" });
    expect(result.source.mode).toBe("seed");
    expect(result.rate).toBeGreaterThan(0);
    expect(result.converted_amount).toBeGreaterThan(0);
  });
});
