import { readSeedJson, roundMoney } from "../shared";
import type { FxConvertInput, FxConvertResult, FxProvider } from "./types";

interface FxSeed {
  fixture_id: string;
  captured_at: string;
  rates: Array<{
    from: string;
    to: string;
    rate: number;
    source_url?: string;
  }>;
}

export function createSeedFxProvider(): FxProvider {
  return {
    async convert(input: FxConvertInput): Promise<FxConvertResult> {
      const seed = await readSeedJson<FxSeed>("seed/fx/cny-sgd.json");
      const rate = seed.rates.find(
        (candidate) =>
          candidate.from.toUpperCase() === input.from.toUpperCase() &&
          candidate.to.toUpperCase() === input.to.toUpperCase(),
      );
      if (!rate) {
        throw new Error(`FX rate not found from=${input.from} to=${input.to}`);
      }

      return {
        source: {
          provider: "fx",
          mode: "seed",
          fixture_id: seed.fixture_id,
          source_url: rate.source_url,
          captured_at: seed.captured_at,
        },
        amount: input.amount,
        from: input.from.toUpperCase(),
        to: input.to.toUpperCase(),
        rate: rate.rate,
        converted_amount: roundMoney(input.amount * rate.rate),
      };
    },
  };
}

export const fxProvider = createSeedFxProvider();
export type * from "./types";
