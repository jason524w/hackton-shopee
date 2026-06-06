import { describe, expect, it } from "vitest";
import {
  createChromeBrowserRetrievalProvider,
  createSeedBrowserRetrievalProvider,
  type BrowserController,
} from "../index";

describe("browser retrieval provider", () => {
  it("extracts seed-backed Shopee search and 1688 offer signals with audit snapshots", async () => {
    const provider = createSeedBrowserRetrievalProvider();
    const shopee = await provider.extractShopeeSearch({
      query: "mini desk vacuum",
      market: "Singapore",
      category: "home_appliances_small",
      limit: 5,
    });
    const sourcing = await provider.extract1688Search({ query: "mini desk vacuum", limit: 5 });
    const offer = await provider.extract1688Offer({ offerId: sourcing.offers[0]?.offer_id });

    expect(shopee.products.length).toBeGreaterThan(0);
    expect(shopee.source.raw_snapshot_id).toBeTruthy();
    expect(shopee.source.extracted_text_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(sourcing.offers.length).toBeGreaterThan(0);
    if ("available" in offer) {
      throw new Error(`Seed 1688 offer detail should be available: ${offer.reason}`);
    }
    expect(offer.offer.package_weight_g).toBeGreaterThan(0);
    expect(offer.offer.supplier_stability.stability_score).toBeGreaterThan(0);
    expect(offer.offer.negotiation_notes.length).toBeGreaterThan(0);
  });

  it("does not fabricate Taobao rows in seed mode", async () => {
    const provider = createSeedBrowserRetrievalProvider();
    const result = await provider.extractTaobaoSearch({ query: "桌面吸尘器", limit: 5 });

    expect(result.source.mode).toBe("seed");
    expect(result.offers).toHaveLength(0);
    expect(result.snapshot.warnings.join(" ")).toMatch(/does not fabricate/i);
    expect(result.warnings?.[0]?.code).toBe("TAOBAO_SEED_EMPTY");
  });

  it("parses Taobao visible product rows from Chrome snapshots", async () => {
    const controller: BrowserController = {
      async capture(input) {
        return {
          url: input.url,
          title: "桌面吸尘器_淘宝搜索",
          text: [
            "桌面清洁小车吸尘器可爱迷你桌面吸尘器学生橡皮屑键盘清理器",
            "¥",
            "10",
            ".33",
            "1万+人付款",
            "安徽",
            "合肥",
            "锐耀数码专营店",
          ].join("\n"),
          links: [],
          captured_at: "2026-06-06T00:00:00.000Z",
        };
      },
    };
    const provider = createChromeBrowserRetrievalProvider(controller, {
      allowedDomains: ["taobao.com"],
      maxSteps: 2,
    });

    const result = await provider.extractTaobaoSearch({ query: "桌面吸尘器", limit: 3 });

    expect(result.source.mode).toBe("browser");
    expect(result.snapshot.extraction_method).toBe("chrome");
    expect(result.offers).toHaveLength(1);
    expect(result.offers[0]?.title).toMatch(/桌面清洁/);
    expect(result.offers[0]?.source_price_cny).toBe(10.33);
    expect(result.offers[0]?.supplier_name).toBe("锐耀数码专营店");
  });

  it("returns unavailable metadata for pending Chrome sourcing detail tools", async () => {
    const controller: BrowserController = {
      async capture(input) {
        return {
          url: input.url,
          title: "1688 offer",
          text: "桌面吸尘器 ¥ 12.8 深圳供应商",
          links: [],
          captured_at: "2026-06-06T00:00:00.000Z",
        };
      },
    };
    const provider = createChromeBrowserRetrievalProvider(controller, {
      allowedDomains: ["1688.com"],
      maxSteps: 2,
    });

    const offer = await provider.extract1688Offer({ url: "https://detail.1688.com/offer/example.html" });
    const stock = await provider.refreshOfferStock({ offerId: "live_1688_example" });
    const supplier = await provider.extractSupplierSignals({ supplierName: "深圳供应商" });

    expect("available" in offer && offer.available).toBe(false);
    expect("available" in stock && stock.available).toBe(false);
    expect("available" in supplier && supplier.available).toBe(false);
    expect(offer.warnings?.[0]?.code).toBe("CHROME_1688_OFFER_PARSER_PENDING");
    expect(stock.warnings?.[0]?.code).toBe("CHROME_STOCK_REFRESH_URL_REQUIRED");
    expect(supplier.warnings?.[0]?.code).toBe("CHROME_SUPPLIER_PROFILE_URL_REQUIRED");
  });

  it("keeps Chrome mode constrained by domain allowlist", async () => {
    const controller: BrowserController = {
      async capture(input) {
        return {
          url: input.url,
          title: "Captured",
          text: "mini desk vacuum browser evidence",
          links: [{ label: "Shopee", url: "https://shopee.sg/" }],
          captured_at: "2026-06-06T00:00:00.000Z",
        };
      },
    };
    const provider = createChromeBrowserRetrievalProvider(controller, {
      allowedDomains: ["shopee.sg"],
      maxSteps: 2,
    });

    await expect(
      provider.retrievePageSnapshot({
        url: "https://example.com/",
        purpose: "market_web_trend",
      }),
    ).rejects.toThrow(/blocked/);

    const snapshot = await provider.retrievePageSnapshot({
      url: "https://shopee.sg/search?keyword=mini%20desk%20vacuum",
      purpose: "market_shopee_search",
    });
    expect(snapshot.source.mode).toBe("browser");
    expect(snapshot.snapshot.extraction_method).toBe("chrome");
  });
});
