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

  it("merges multi-page 1688 search rows, dedupes repeats, and stops when a page adds nothing new", async () => {
    const controller: BrowserController = {
      async capture(input) {
        const page2 = input.url.includes("beginPage=2");
        return {
          url: input.url,
          title: "1688搜索",
          text: page2
            ? ["桌面吸尘器B款迷你键盘清洁器学生用", "¥15.50", "桌面吸尘器A款手持清洁器USB充电", "¥12.80"].join("\n")
            : ["桌面吸尘器A款手持清洁器USB充电", "¥12.80"].join("\n"),
          links: [],
          captured_at: "2026-06-06T00:00:00.000Z",
        };
      },
    };
    const provider = createChromeBrowserRetrievalProvider(controller, {
      allowedDomains: ["1688.com"],
      maxSteps: 2,
    });

    const result = await provider.extract1688Search({ query: "桌面吸尘器", limit: 10, pages: 3 });

    // Page 1: offer A. Page 2: offer B (+ duplicate A removed). Page 3: same as page 1 → nothing new → early stop.
    expect(result.offers).toHaveLength(2);
    expect(result.offers.map((offer) => offer.source_price_cny).sort()).toEqual([12.8, 15.5]);
    expect(result.pages_scanned).toBe(3);
    expect(result.page_snapshots).toHaveLength(3);
    expect(result.warnings?.some((warning) => warning.code === "CHROME_PAGINATION_NO_NEW_ROWS")).toBe(true);
  });

  it("keeps earlier page rows when a later page hits an access verification wall", async () => {
    const controller: BrowserController = {
      async capture(input) {
        const page2 = input.url.includes("beginPage=2");
        return {
          url: input.url,
          title: page2 ? "安全验证" : "1688搜索",
          text: page2
            ? "安全验证 请拖动滑块完成验证"
            : ["桌面吸尘器A款手持清洁器USB充电", "¥12.80"].join("\n"),
          links: [],
          captured_at: "2026-06-06T00:00:00.000Z",
        };
      },
    };
    const provider = createChromeBrowserRetrievalProvider(controller, {
      allowedDomains: ["1688.com"],
      maxSteps: 2,
    });

    const result = await provider.extract1688Search({ query: "桌面吸尘器", limit: 10, pages: 3 });

    expect(result.offers).toHaveLength(1);
    expect(result.pages_scanned).toBe(2);
    expect(result.warnings?.[0]?.code).toBe("CHROME_PAGINATION_ACCESS_CHALLENGE");
  });

  it("does not mistake long marketplace pages mentioning robots or 已验证 for challenge walls", async () => {
    const filler = "桌面吸尘器迷你键盘清洁器 robot vacuum 已验证供应商 ".repeat(80);
    const controller: BrowserController = {
      async capture(input) {
        return {
          url: input.url,
          title: "1688搜索",
          text: [filler, "桌面吸尘器A款手持清洁器USB充电", "¥12.80"].join("\n"),
          links: [],
          captured_at: "2026-06-06T00:00:00.000Z",
        };
      },
    };
    const provider = createChromeBrowserRetrievalProvider(controller, {
      allowedDomains: ["1688.com"],
      maxSteps: 2,
    });

    const result = await provider.extract1688Search({ query: "桌面吸尘器", limit: 5 });
    expect(result.offers.length).toBeGreaterThan(0);
  });

  it("parses comparable specs from 1688 and Taobao detail snapshots", async () => {
    const controller: BrowserController = {
      async capture(input) {
        const taobao = input.url.includes("taobao.com");
        return {
          url: input.url,
          title: taobao ? "迷你桌面吸尘器淘宝详情" : "桌面吸尘器1688详情",
          text: taobao
            ? [
                "桌面清洁小车吸尘器可爱迷你桌面吸尘器学生橡皮屑键盘清理器",
                "¥",
                "10",
                ".33",
                "库存 268 件",
                "包装重量 0.32kg",
                "包装尺寸 10x10x8cm",
                "锐耀数码专营店",
                "安徽 合肥",
              ].join("\n")
            : [
                "桌面吸尘器手持学生大吸力电动橡皮擦USB充电款儿童桌面清洁神器",
                "¥13.00",
                "库存 1200 件",
                "起批 1 件",
                "商品属性",
                "材质",
                "塑料",
                "品牌",
                "咔巴熊",
                "型号",
                "KBX-3091",
                "长x宽x高",
                "80×80×60（mm）",
                "净重",
                "0.2",
                "商品件重尺",
                "重量(g)",
                "150",
                "深圳市清洁电器工厂",
                "广东 深圳",
              ].join("\n"),
          links: [],
          captured_at: "2026-06-06T00:00:00.000Z",
        };
      },
    };
    const provider = createChromeBrowserRetrievalProvider(controller, {
      allowedDomains: ["1688.com", "taobao.com"],
      maxSteps: 2,
    });

    const offer1688 = await provider.extract1688Offer({ url: "https://detail.1688.com/offer/example.html" });
    const offerTaobao = await provider.extractTaobaoOffer({ url: "https://item.taobao.com/item.htm?id=123" });

    if ("available" in offer1688) throw new Error(offer1688.reason);
    if ("available" in offerTaobao) throw new Error(offerTaobao.reason);
    expect(offer1688.offer.package_weight_g).toBe(150);
    expect(offer1688.offer.package_dimensions_cm).toEqual({ length: 8, width: 8, height: 6 });
    expect(offer1688.offer.available_stock).toBe(1200);
    expect(offer1688.offer.supplier_name).toMatch(/工厂/);
    expect(offerTaobao.offer.package_weight_g).toBe(320);
    expect(offerTaobao.offer.package_dimensions_cm).toEqual({ length: 10, width: 10, height: 8 });
    expect(offerTaobao.offer.available_stock).toBe(268);
    expect(offerTaobao.offer.supplier_name).toBe("锐耀数码专营店");
  });

  it("parses single-value 1688 length-width-height as equal dimensions with review note", async () => {
    const controller: BrowserController = {
      async capture(input) {
        return {
          url: input.url,
          title: "咔巴熊桌面吸尘器",
          text: [
            "咔巴熊桌面吸尘器清洁文具学生吸橡皮擦屑铅笔灰儿童电动小型迷你",
            "¥6.00",
            "库存 500 件",
            "商品属性",
            "品牌",
            "咔巴熊",
            "型号",
            "KBX-3091",
            "长x宽x高",
            "20（mm）",
            "商品件重尺",
            "重量(g)",
            "150",
            "义乌市咔巴熊文具商行",
            "浙江 义乌",
          ].join("\n"),
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

    if ("available" in offer) throw new Error(offer.reason);
    expect(offer.offer.package_weight_g).toBe(150);
    expect(offer.offer.package_dimensions_cm).toEqual({ length: 2, width: 2, height: 2 });
    expect(offer.offer.supplier_risk_notes.join(" ")).toMatch(/one value under 长x宽x高/);
  });

  it("returns unavailable metadata when detail snapshots lack comparable specs", async () => {
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
    expect(offer.warnings?.[0]?.code).toBe("CHROME_1688_OFFER_DETAIL_INCOMPLETE");
    expect("available" in offer && offer.reason).toMatch(/package weight|package dimensions/);
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
