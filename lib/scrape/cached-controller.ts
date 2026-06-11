import type {
  BrowserController,
  BrowserControllerSnapshot,
  BrowserRetrievalPolicy,
  BrowserRetrievalPurpose,
} from "../providers/browser-retrieval/types";
import { scrapeCacheKey, type ScrapeCache } from "./cache";

/**
 * TTL per scrape purpose. Searches change faster than detail/spec pages, which are stable
 * for days. Tunable; these defaults favor freshness for demand signals and reuse for specs.
 */
export type ScrapeTtlByPurpose = Partial<Record<BrowserRetrievalPurpose, number>>;

const HOUR = 60 * 60 * 1000;
const DEFAULT_TTL_BY_PURPOSE: Record<BrowserRetrievalPurpose, number> = {
  market_shopee_search: 6 * HOUR,
  market_shopee_product: 24 * HOUR,
  market_shopee_ads: 6 * HOUR,
  market_web_trend: 12 * HOUR,
  sourcing_1688_search: 6 * HOUR,
  sourcing_1688_offer: 48 * HOUR,
  sourcing_taobao_search: 6 * HOUR,
  sourcing_taobao_offer: 48 * HOUR,
  sourcing_supplier_profile: 7 * 24 * HOUR,
};

export interface CachedBrowserControllerOptions {
  ttlByPurpose?: ScrapeTtlByPurpose;
  /** Skip the cache entirely (e.g. a forced refresh). Default false. */
  bypass?: boolean;
}

/**
 * Wrap a BrowserController so identical captures (same purpose + URL) are served from a
 * scrape cache within a TTL instead of re-scraping. Cuts cost/latency and — importantly for
 * marketplaces — reduces anti-bot exposure from repeated hits.
 *
 * Login-gated captures (`requires_human_login`, e.g. Seller Centre) are NOT cached: they
 * depend on session state and are too sensitive to persist. A cache write failure never
 * fails the capture (best-effort).
 */
export function createCachedBrowserController(
  inner: BrowserController,
  cache: ScrapeCache,
  options: CachedBrowserControllerOptions = {},
): BrowserController {
  const ttlByPurpose = { ...DEFAULT_TTL_BY_PURPOSE, ...options.ttlByPurpose };

  return {
    async capture(input: {
      url: string;
      purpose: BrowserRetrievalPurpose;
      policy: BrowserRetrievalPolicy;
    }): Promise<BrowserControllerSnapshot> {
      const cacheable = !options.bypass && !input.policy.requires_human_login;
      const key = scrapeCacheKey(input.purpose, input.url);

      if (cacheable) {
        const hit = await cache.get<BrowserControllerSnapshot>(key).catch(() => undefined);
        if (hit) {
          return { ...hit.value, from_cache: true };
        }
      }

      const snapshot = await inner.capture(input);

      if (cacheable) {
        const ttl = ttlByPurpose[input.purpose] ?? 6 * HOUR;
        // Don't persist the absolute screenshot path — it's instance-local and the cached
        // serve shouldn't claim a screenshot that may have been cleaned up.
        const { screenshot_path: _screenshot, from_cache: _fromCache, ...cacheable_snapshot } = snapshot;
        await cache.set(key, cacheable_snapshot, ttl).catch(() => undefined);
      }

      return snapshot;
    },
  };
}
