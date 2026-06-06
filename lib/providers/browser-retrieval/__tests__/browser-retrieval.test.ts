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
    expect(offer.offer.package_weight_g).toBeGreaterThan(0);
    expect(offer.offer.supplier_stability.stability_score).toBeGreaterThan(0);
    expect(offer.offer.negotiation_notes.length).toBeGreaterThan(0);
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
