import type { AgentTool } from "../../agent-runtime/tool-runner";
import { makeObjectSchema } from "../../agent-runtime/schemas";
import type {
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
  ];
}

