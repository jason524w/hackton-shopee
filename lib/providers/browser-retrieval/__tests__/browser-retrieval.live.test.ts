import { describe, expect, it } from "vitest";
import {
  createCdpChromeBrowserController,
  createChromeBrowserRetrievalProvider,
} from "../index";

const live = process.env.LIVE_BROWSER_TESTS === "1";

describe.skipIf(!live)("browser retrieval provider live Chrome tests", () => {
  const controller = createCdpChromeBrowserController({
    endpoint: process.env.CHROME_CDP_ENDPOINT ?? "http://127.0.0.1:9222",
    screenshotDir: process.env.LIVE_BROWSER_SCREENSHOT_DIR,
    navigationTimeoutMs: 30_000,
    settleMs: 2_000,
  });
  const provider = createChromeBrowserRetrievalProvider(controller, {
    allowedDomains: ["shopee.sg", "1688.com", "google.com"],
    maxSteps: 3,
  });

  it("extracts real Shopee search products through Chrome CDP", async () => {
    const result = await provider.extractShopeeSearch({
      query: "mini desk vacuum",
      market: "Singapore",
      category: "home_appliances_small",
      limit: 5,
    });

    expect(result.source.mode).toBe("browser");
    expect(result.snapshot.extraction_method).toBe("chrome");
    expect(result.products.length).toBeGreaterThan(0);
    expect(result.products[0]?.title).toMatch(/vacuum|cleaner|desktop|desk|keyboard/i);
    expect(result.products[0]?.price_sgd).toBeGreaterThan(0);
    expect(result.source.raw_snapshot_id).toMatch(/^browser_chrome_/);
    expect(result.source.extracted_text_hash).toMatch(/^[a-f0-9]{64}$/);
  }, 45_000);

  it("extracts real 1688 offer rows through Chrome CDP", async () => {
    const result = await provider.extract1688Search({ query: "mini desk vacuum", limit: 5 });

    expect(result.source.mode).toBe("browser");
    expect(result.snapshot.extraction_method).toBe("chrome");
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers[0]?.source_price_cny).toBeGreaterThan(0);
    expect(result.source.raw_snapshot_id).toMatch(/^browser_chrome_/);
    expect(result.source.extracted_text_hash).toMatch(/^[a-f0-9]{64}$/);
  }, 45_000);

  it("blocks non-allowed domains in live Chrome mode", async () => {
    await expect(
      provider.retrievePageSnapshot({
        url: "https://example.com/",
        purpose: "market_web_trend",
      }),
    ).rejects.toThrow(/blocked/);
  });
});
