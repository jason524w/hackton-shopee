import type { AgentTool } from "../../agent-runtime/tool-runner";
import { makeObjectSchema } from "../../agent-runtime/schemas";
import type {
  Browser1688OfferInput,
  Browser1688SearchInput,
  BrowserOfferStockInput,
  BrowserRetrievePageSnapshotInput,
  BrowserSupplierSignalsInput,
  BrowserTaobaoSearchInput,
  FxConvertInput,
  ShippingEstimateInput,
  SourcingOfferDetailInput,
  SourcingSearchOffersInput,
} from "../../providers";
import type { AgentProviders } from "../contracts";

export function createSourcingTools(providers: AgentProviders): AgentTool[] {
  return [
    {
      name: "sourcing_search_offers",
      description: "Search seed-backed or live 1688 supplier offers for the selected product direction.",
      parameters: makeObjectSchema({
        query: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 20 },
      }),
      execute(input: unknown) {
        return providers.sourcing1688.searchOffers(input as SourcingSearchOffersInput);
      },
    },
    {
      name: "sourcing_get_offer_detail",
      description: "Fetch detailed supplier offer specs including MOQ, stock, package weight and dimensions.",
      parameters: makeObjectSchema({
        offerId: { type: "string" },
      }),
      execute(input: unknown) {
        return providers.sourcing1688.getOfferDetail(input as SourcingOfferDetailInput);
      },
    },
    {
      name: "fx_convert",
      description: "Convert a source currency amount into target currency through the FX provider.",
      parameters: makeObjectSchema({
        amount: { type: "number", minimum: 0 },
        from: { type: "string" },
        to: { type: "string" },
      }),
      execute(input: unknown) {
        return providers.fx.convert(input as FxConvertInput);
      },
    },
    {
      name: "shipping_estimate_cross_border",
      description: "Estimate cross-border shipping low/base/high scenarios through the shipping provider.",
      parameters: makeObjectSchema({
        weight_g: { type: "number", minimum: 0 },
        dimensions_cm: makeObjectSchema({
          length: { type: "number", minimum: 0 },
          width: { type: "number", minimum: 0 },
          height: { type: "number", minimum: 0 },
        }),
        from: { type: "string" },
        to: { type: "string" },
      }),
      execute(input: unknown) {
        return providers.shipping.estimateCrossBorder(input as ShippingEstimateInput);
      },
    },
    {
      name: "browser_retrieve_page_snapshot",
      description:
        "Capture a controlled browser page snapshot for an allowed sourcing URL. Returns redacted text excerpt, links, source metadata, and audit snapshot ids.",
      parameters: makeObjectSchema({
        url: { type: "string" },
        purpose: {
          type: "string", enum: ["sourcing_1688_search", "sourcing_1688_offer", "sourcing_taobao_search", "sourcing_supplier_profile"],
        },
      }),
      execute(input: unknown) {
        return providers.browser.retrievePageSnapshot(input as BrowserRetrievePageSnapshotInput);
      },
    },
    {
      name: "browser_extract_1688_search",
      description:
        "Use the controlled browser retrieval provider to extract 1688 search offer signals when direct API access is unavailable.",
      parameters: makeObjectSchema({
        query: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 20 },
      }),
      execute(input: unknown) {
        return providers.browser.extract1688Search(input as Browser1688SearchInput);
      },
    },
    {
      name: "browser_extract_taobao_search",
      description:
        "Use a user-authorized controlled browser session to extract visible Taobao sourcing proxy rows when wholesale APIs or 1688 browser access are unavailable.",
      parameters: makeObjectSchema({
        query: { type: "string" },
        limit: { type: "number", minimum: 1, maximum: 20 },
      }),
      execute(input: unknown) {
        return providers.browser.extractTaobaoSearch(input as BrowserTaobaoSearchInput);
      },
    },
    {
      name: "browser_extract_1688_offer",
      description:
        "Use the controlled browser retrieval provider to extract a 1688 offer page by offer id or URL.",
      // strict function schemas require every key in `required`; optionality is
      // expressed via nullable types instead.
      parameters: makeObjectSchema({
        offerId: { type: ["string", "null"] },
        url: { type: ["string", "null"] },
      }),
      execute(input: unknown) {
        return providers.browser.extract1688Offer(input as Browser1688OfferInput);
      },
    },
    {
      name: "browser_extract_taobao_offer",
      description:
        "Use a user-authorized controlled browser session to extract a Taobao/Tmall product detail page by item URL.",
      // strict function schemas require every key in `required`; optionality is
      // expressed via nullable types instead.
      parameters: makeObjectSchema({
        offerId: { type: ["string", "null"] },
        url: { type: ["string", "null"] },
      }),
      execute(input: unknown) {
        return providers.browser.extractTaobaoOffer(input as Browser1688OfferInput);
      },
    },
    {
      name: "browser_refresh_offer_stock",
      description:
        "Use the controlled browser retrieval provider to refresh currently visible stock for a 1688 offer.",
      parameters: makeObjectSchema({
        offerId: { type: "string" },
      }),
      execute(input: unknown) {
        return providers.browser.refreshOfferStock(input as BrowserOfferStockInput);
      },
    },
    {
      name: "browser_extract_supplier_signals",
      description:
        "Use the controlled browser retrieval provider to extract supplier stability and negotiation signals.",
      parameters: makeObjectSchema({
        offerId: { type: ["string", "null"] },
        supplierName: { type: ["string", "null"] },
      }),
      execute(input: unknown) {
        return providers.browser.extractSupplierSignals(input as BrowserSupplierSignalsInput);
      },
    },
  ];
}
