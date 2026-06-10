import { readSeedJson, roundMoney } from "../shared";
import type { ProviderWarning } from "../shared";
import type { FxConvertInput, FxConvertResult, FxProvider } from "./types";

const FX_STALE_AFTER_DAYS = 30;

function fxStalenessWarnings(capturedAt: string): ProviderWarning[] {
  const captured = Date.parse(capturedAt);
  if (Number.isNaN(captured)) {
    return [];
  }
  const ageDays = (Date.now() - captured) / (1000 * 60 * 60 * 24);
  if (ageDays <= FX_STALE_AFTER_DAYS) {
    return [];
  }
  return [
    {
      code: "FX_RATE_STALE",
      severity: "warning",
      message: `Seed FX rate was captured ${Math.round(ageDays)} days ago (>${FX_STALE_AFTER_DAYS}d); refresh the seed or use a live FX source before relying on margins.`,
    },
  ];
}

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

      const warnings = fxStalenessWarnings(seed.captured_at);

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
        warnings: warnings.length ? warnings : undefined,
      };
    },
  };
}

export const fxProvider = createSeedFxProvider();
export type * from "./types";
