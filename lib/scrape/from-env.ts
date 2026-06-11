import { join } from "node:path";
import type { BrowserController } from "../providers/browser-retrieval/types";
import { resolveAuditRoot } from "../agents/audit-root";
import { createCircuitBreaker } from "./circuit-breaker";
import { createHandoffQueue } from "./handoff";
import { createManagedBrowserController } from "./managed-controller";
import { createPlaywrightEngine } from "./playwright-engine";
import { createProxyPool, type Proxy } from "./proxy-pool";
import { createTokenBucketRateLimiter } from "./rate-limiter";
import { FilesystemSessionStore } from "./session-store";

function num(name: string, fallback: number): number {
  const v = Number.parseFloat(process.env[name] ?? "");
  return Number.isFinite(v) ? v : fallback;
}

function proxiesFromEnv(): Proxy[] {
  return (process.env.SCRAPE_PROXY_URLS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((url, i) => ({ id: `proxy${i + 1}`, url }));
}

/**
 * Build the production managed scrape controller (Playwright engine + proxy pool + rate
 * limiter + circuit breaker + session store + handoff queue) from environment config.
 *
 * Opt-in: only used when SCRAPE_ENGINE=playwright (and BROWSER_RETRIEVAL_MODE=live). Requires
 * `playwright` installed on the host (see docs/SCRAPE.md). Knobs:
 *   SCRAPE_PROXY_URLS        comma-separated proxy URLs (omit → no proxy)
 *   SCRAPE_PROXY_COOLDOWN_MS parked-proxy cooldown (default 120000)
 *   SCRAPE_RATE_BURST        token-bucket capacity per platform (default 5)
 *   SCRAPE_RATE_PER_SEC      tokens/sec per platform (default 0.2 = 1 per 5s)
 *   SCRAPE_CB_THRESHOLD      consecutive failures to trip the breaker (default 4)
 *   SCRAPE_CB_COOLDOWN_MS    breaker cooldown (default 60000)
 *   SCRAPE_HEADLESS          "false" to show the browser (default headless)
 */
export function createManagedControllerFromEnv(): BrowserController {
  const proxies = proxiesFromEnv();
  const root = resolveAuditRoot();

  return createManagedBrowserController({
    engine: createPlaywrightEngine({ headless: process.env.SCRAPE_HEADLESS !== "false" }),
    rateLimiter: createTokenBucketRateLimiter({
      capacity: num("SCRAPE_RATE_BURST", 5),
      refillPerSec: num("SCRAPE_RATE_PER_SEC", 0.2),
    }),
    circuitBreaker: createCircuitBreaker({
      failureThreshold: num("SCRAPE_CB_THRESHOLD", 4),
      cooldownMs: num("SCRAPE_CB_COOLDOWN_MS", 60_000),
    }),
    proxyPool: proxies.length
      ? createProxyPool(proxies, { cooldownMs: num("SCRAPE_PROXY_COOLDOWN_MS", 120_000) })
      : undefined,
    sessionStore: new FilesystemSessionStore(join(root, "scrape-sessions")),
    handoff: createHandoffQueue({
      notify: (req) =>
        console.warn(`[scrape-handoff] ${req.platform} needs human verification: ${req.url} (handoff ${req.id})`),
    }),
    screenshotDir: join(root, "scrape-screenshots"),
  });
}
