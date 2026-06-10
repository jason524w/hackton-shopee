import { readSeedJson, roundMoney } from "../shared";
import type { ProviderWarning } from "../shared";
import type { FxConvertInput, FxConvertResult, FxProvider } from "./types";

const FX_STALE_AFTER_DAYS = 30;

function fxStalenessWarnings(capturedAt: string, mode: "seed" | "live"): ProviderWarning[] {
  const captured = Date.parse(capturedAt);
  if (Number.isNaN(captured)) {
    return [];
  }
  const ageDays = (Date.now() - captured) / (1000 * 60 * 60 * 24);
  if (ageDays <= FX_STALE_AFTER_DAYS) {
    return [];
  }
  const label = mode === "seed" ? "Seed FX rate" : "FX rate";
  return [
    {
      code: "FX_RATE_STALE",
      severity: "warning",
      message: `${label} was captured ${Math.round(ageDays)} days ago (>${FX_STALE_AFTER_DAYS}d); refresh before relying on margins.`,
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

      const warnings = fxStalenessWarnings(seed.captured_at, "seed");

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

// ---------------------------------------------------------------------------
// Live FX provider
// ---------------------------------------------------------------------------

export type FxFetcher = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface LiveFxProviderOptions {
  /** Base URL template; `{base}` is replaced with the source currency. Default: open.er-api.com (free, no key). */
  baseUrl?: string;
  /** Cache TTL in ms. FX moves slowly; default 6h keeps cost/latency down without staleness risk. */
  cacheTtlMs?: number;
  /** Injectable for tests; defaults to global fetch. */
  fetcher?: FxFetcher;
  /** Injectable clock for tests. */
  now?: () => number;
}

interface CacheEntry {
  rates: Record<string, number>;
  capturedAtIso: string;
  fetchedAtMs: number;
  sourceUrl: string;
}

const DEFAULT_FX_BASE_URL = "https://open.er-api.com/v6/latest/{base}";
const DEFAULT_FX_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Live FX via a real rates API (default open.er-api.com — free, no API key).
 * Rates per source currency are cached in-process with a TTL so a multi-agent run
 * doesn't hammer the API. On a fetch failure we serve the last good cached rates if
 * any, otherwise surface a clear error (no silent seed fallback — per the all-live
 * policy); callers wanting a seed safety net should compose providers explicitly.
 */
export function createLiveFxProvider(options: LiveFxProviderOptions = {}): FxProvider {
  const baseUrl = options.baseUrl ?? process.env.FX_API_URL ?? DEFAULT_FX_BASE_URL;
  const cacheTtlMs = options.cacheTtlMs ?? DEFAULT_FX_CACHE_TTL_MS;
  // Default fetcher has an 8s timeout so a stalled FX API can't hang a run.
  const fetcher: FxFetcher = options.fetcher ?? ((url) => fetch(url, { signal: AbortSignal.timeout(8_000) }));
  const now = options.now ?? Date.now;
  const cache = new Map<string, CacheEntry>();

  async function ratesForBase(base: string): Promise<CacheEntry> {
    const cached = cache.get(base);
    if (cached && now() - cached.fetchedAtMs < cacheTtlMs) {
      return cached;
    }
    const url = baseUrl.replace("{base}", encodeURIComponent(base));
    let response: Awaited<ReturnType<FxFetcher>>;
    try {
      response = await fetcher(url);
    } catch (error) {
      if (cached) {
        return cached; // network blip: serve last good rates rather than failing the run
      }
      throw new Error(`FX live fetch failed for ${base}: ${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) {
      if (cached) {
        return cached;
      }
      throw new Error(`FX live fetch for ${base} returned HTTP ${response.status}`);
    }
    const payload = (await response.json()) as {
      result?: string;
      rates?: Record<string, number>;
      time_last_update_utc?: string;
      time_last_update_unix?: number;
    };
    if (payload.result && payload.result !== "success") {
      if (cached) {
        return cached;
      }
      throw new Error(`FX live fetch for ${base} returned result=${payload.result}`);
    }
    if (!payload.rates || typeof payload.rates !== "object") {
      if (cached) {
        return cached;
      }
      throw new Error(`FX live response for ${base} had no rates map`);
    }
    const capturedAtIso = payload.time_last_update_unix
      ? new Date(payload.time_last_update_unix * 1000).toISOString()
      : payload.time_last_update_utc
        ? new Date(payload.time_last_update_utc).toISOString()
        : new Date(now()).toISOString();
    const entry: CacheEntry = {
      rates: payload.rates,
      capturedAtIso,
      fetchedAtMs: now(),
      sourceUrl: url,
    };
    cache.set(base, entry);
    return entry;
  }

  return {
    async convert(input: FxConvertInput): Promise<FxConvertResult> {
      const from = input.from.toUpperCase();
      const to = input.to.toUpperCase();
      if (from === to) {
        return {
          source: { provider: "fx", mode: "live", captured_at: new Date(now()).toISOString() },
          amount: input.amount,
          from,
          to,
          rate: 1,
          converted_amount: roundMoney(input.amount),
        };
      }
      const entry = await ratesForBase(from);
      const rate = entry.rates[to];
      if (typeof rate !== "number" || !Number.isFinite(rate) || rate <= 0) {
        throw new Error(`FX live rate ${from}->${to} unavailable in source response`);
      }
      // Cached serves are still live-sourced data (captured_at reflects the API's last update);
      // we report mode "live" and let captured_at + staleness warnings convey freshness.
      const warnings = fxStalenessWarnings(entry.capturedAtIso, "live");
      return {
        source: {
          provider: "fx",
          mode: "live",
          source_url: entry.sourceUrl,
          captured_at: entry.capturedAtIso,
        },
        amount: input.amount,
        from,
        to,
        rate,
        converted_amount: roundMoney(input.amount * rate),
        warnings: warnings.length ? warnings : undefined,
      };
    },
  };
}

/**
 * Env-routed FX provider. Defaults to LIVE (all-live policy); set `FX_PROVIDER=seed`
 * to force the deterministic seed provider (tests, offline rehearsal).
 */
export function createFxProviderFromEnv(): FxProvider {
  return process.env.FX_PROVIDER === "seed" ? createSeedFxProvider() : createLiveFxProvider();
}

export const fxProvider = createFxProviderFromEnv();
export type * from "./types";
