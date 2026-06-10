import { includesQuery, readSeedJson } from "../shared";
import type { ProviderWarning } from "../shared";
import type {
  Sourcing1688Provider,
  SourcingOfferDetail,
  SourcingOfferDetailInput,
  SourcingOfferDetailResult,
  SourcingOfferSummary,
  SourcingSearchOffersInput,
  SourcingSearchOffersResult,
} from "./types";

interface SourcingSeed {
  fixture_id: string;
  captured_at: string;
  offers: SourcingOfferDetail[];
}

export function createSeedSourcing1688Provider(): Sourcing1688Provider {
  return {
    async searchOffers(input: SourcingSearchOffersInput): Promise<SourcingSearchOffersResult> {
      const seed = await readSeedJson<SourcingSeed>("seed/sourcing-1688/mini-desk-vacuum-offers.json");
      // Do NOT fabricate matches: an unmatched query returns an empty offer set + warning
      // instead of passing off the desk-vacuum seed as if it were the requested product.
      const matched = seed.offers.filter((offer) => includesQuery(offer.title, input.query));
      const offers = matched.slice(0, input.limit ?? matched.length);
      const warnings: ProviderWarning[] = matched.length
        ? []
        : [
            {
              code: "SEED_QUERY_MISMATCH",
              severity: "warning",
              message: `Seed 1688 data does not cover "${input.query}"; returning no offers rather than fabricating unrelated rows. Enable a live sourcing provider for arbitrary queries.`,
            },
          ];

      return {
        source: {
          provider: "sourcing-1688",
          mode: "seed",
          fixture_id: seed.fixture_id,
          captured_at: seed.captured_at,
        },
        query: input.query,
        offers: offers.map(toSummary),
        warnings: warnings.length ? warnings : undefined,
      };
    },

    async getOfferDetail(input: SourcingOfferDetailInput): Promise<SourcingOfferDetailResult> {
      const seed = await readSeedJson<SourcingSeed>("seed/sourcing-1688/mini-desk-vacuum-offers.json");
      const offer = seed.offers.find((candidate) => candidate.offer_id === input.offerId);
      if (!offer) {
        throw new Error(`1688 offer detail not found for offerId=${input.offerId}`);
      }

      return {
        source: {
          provider: "sourcing-1688",
          mode: "seed",
          fixture_id: seed.fixture_id,
          source_url: offer.source_url,
          captured_at: seed.captured_at,
        },
        offer,
      };
    },
  };
}

export const sourcing1688Provider = createSeedSourcing1688Provider();
export type * from "./types";

function toSummary(offer: SourcingOfferDetail): SourcingOfferSummary {
  return {
    offer_id: offer.offer_id,
    title: offer.title,
    source_price_cny: offer.source_price_cny,
    currency: offer.currency,
    moq: offer.moq,
    available_stock: offer.available_stock,
    supplier_name: offer.supplier_name,
    supplier_location: offer.supplier_location,
    domestic_dispatch_days: offer.domestic_dispatch_days,
    source_url: offer.source_url,
    evidence_label: offer.evidence_label,
  };
}
