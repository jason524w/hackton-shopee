import { describe, expect, it } from "vitest";
import {
  createCdpChromeBrowserController,
  createChromeBrowserRetrievalProvider,
} from "../index";

const live = process.env.LIVE_BROWSER_TESTS === "1";
const taobaoLive = process.env.LIVE_TAOBAO_TESTS === "1";
const expect1688Offers = process.env.LIVE_1688_EXPECT_OFFERS === "1";

describe.skipIf(!live)("browser retrieval provider live Chrome tests", () => {
  const controller = createCdpChromeBrowserController({
    endpoint: process.env.CHROME_CDP_ENDPOINT ?? "http://127.0.0.1:9222",
    screenshotDir: process.env.LIVE_BROWSER_SCREENSHOT_DIR,
    navigationTimeoutMs: 30_000,
    settleMs: Number(process.env.LIVE_BROWSER_SETTLE_MS ?? 2_000),
  });
  const provider = createChromeBrowserRetrievalProvider(controller, {
    allowedDomains: ["shopee.sg", "1688.com", "taobao.com", "tmall.com", "google.com"],
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

  it("tries real 1688 offer rows through Chrome CDP without seed fallback", async () => {
    try {
      const result = await provider.extract1688Search({ query: "桌面吸尘器", limit: 5 });

      expect(result.source.mode).toBe("browser");
      expect(result.snapshot.extraction_method).toBe("chrome");
      expect(result.offers.length).toBeGreaterThan(0);
      expect(result.offers[0]?.source_price_cny).toBeGreaterThan(0);
      expect(result.source.raw_snapshot_id).toMatch(/^browser_chrome_/);
      expect(result.source.extracted_text_hash).toMatch(/^[a-f0-9]{64}$/);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (expect1688Offers) {
        throw error;
      }
      expect(message).toMatch(
        /access verification|Human login|authorized API|required|No visible 1688 offer rows|seed\/mock data was not used/i,
      );
    }
  }, 45_000);

  it.skipIf(!taobaoLive)("extracts real Taobao rows from a user-authorized Chrome session", async () => {
    const result = await provider.extractTaobaoSearch({ query: "桌面吸尘器", limit: 5 });

    expect(result.source.mode).toBe("browser");
    expect(result.snapshot.extraction_method).toBe("chrome");
    expect(result.offers.length).toBeGreaterThan(0);
    expect(result.offers[0]?.title).toMatch(/吸尘|清洁|桌面|键盘|迷你/);
    expect(result.offers[0]?.source_price_cny).toBeGreaterThan(0);
    expect(result.offers[0]?.supplier_name.length).toBeGreaterThan(0);
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
