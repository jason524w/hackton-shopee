import { mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";
import type {
  BrowserController,
  BrowserControllerSnapshot,
  BrowserRetrievalPolicy,
  BrowserRetrievalPurpose,
} from "../providers/browser-retrieval/types";
import type { CircuitBreaker } from "./circuit-breaker";
import type { ScrapeEngine } from "./engine";
import type { HandoffQueue } from "./handoff";
import { platformOf as defaultPlatformOf } from "./platform";
import type { ProxyPool } from "./proxy-pool";
import type { RateLimiter } from "./rate-limiter";
import type { SessionStore } from "./session-store";

export class ScrapeCircuitOpenError extends Error {
  constructor(public readonly platform: string) {
    super(`Scrape circuit is open for ${platform}; backing off. Falling back to cache/seed or retry later.`);
    this.name = "ScrapeCircuitOpenError";
  }
}

export class ScrapeNoProxyError extends Error {
  constructor(public readonly platform: string) {
    super(`No healthy proxy available for ${platform}; all proxies are cooling down.`);
    this.name = "ScrapeNoProxyError";
  }
}

export class ScrapeChallengeError extends Error {
  constructor(
    public readonly platform: string,
    public readonly url: string,
    public readonly handoffId?: string,
  ) {
    super(
      `Verification challenge on ${platform} (${url}); a human handoff was queued${
        handoffId ? ` (#${handoffId})` : ""
      }. Not bypassing — resolve the challenge to refresh the session.`,
    );
    this.name = "ScrapeChallengeError";
  }
}

export interface ManagedBrowserControllerDeps {
  engine: ScrapeEngine;
  rateLimiter?: RateLimiter;
  circuitBreaker?: CircuitBreaker;
  proxyPool?: ProxyPool;
  sessionStore?: SessionStore;
  handoff?: HandoffQueue;
  platformOf?: (url: string) => string;
  /** Settle time between scroll-capture steps (ms). */
  settleMs?: number;
  /** Where screenshots are written (gitignored, not statically served). */
  screenshotDir?: string;
  now?: () => number;
}

/**
 * Production scrape controller: implements the BrowserController seam the browser-retrieval
 * provider already uses, but drives a pluggable ScrapeEngine through the full anti-ban stack:
 *
 *   circuit breaker → rate limiter → proxy rotation → session restore → engine.capturePage
 *   → on challenge: queue human handoff + trip breaker + throw (never bypass)
 *   → on success: refresh session, report proxy/breaker health, return snapshot
 *
 * Every dependency is optional and injected, so this is fully unit-testable with a fake
 * engine and composes with the A1 scrape cache (which wraps this controller).
 */
export function createManagedBrowserController(deps: ManagedBrowserControllerDeps): BrowserController {
  const platformOf = deps.platformOf ?? defaultPlatformOf;
  const settleMs = deps.settleMs ?? 1500;
  const now = deps.now ?? Date.now;
  const screenshotDir = deps.screenshotDir ?? join(process.cwd(), ".runs", "scrape-screenshots");

  return {
    async capture(input: {
      url: string;
      purpose: BrowserRetrievalPurpose;
      policy: BrowserRetrievalPolicy;
    }): Promise<BrowserControllerSnapshot> {
      const platform = platformOf(input.url);

      // 1. Circuit breaker — don't pile onto a failing platform.
      if (deps.circuitBreaker && !deps.circuitBreaker.canRequest(platform)) {
        throw new ScrapeCircuitOpenError(platform);
      }

      // 2. Rate limit (steady, sub-suspicious cadence per platform).
      if (deps.rateLimiter) {
        await deps.rateLimiter.acquire(platform);
      }

      // 3. Proxy rotation. If a pool is configured but exhausted, fail rather than leaking
      //    the origin IP with a direct connection.
      let proxyId: string | undefined;
      let proxyUrl: string | undefined;
      if (deps.proxyPool) {
        const proxy = deps.proxyPool.acquire();
        if (!proxy) {
          deps.circuitBreaker?.onFailure(platform);
          throw new ScrapeNoProxyError(platform);
        }
        proxyId = proxy.id;
        proxyUrl = proxy.url;
      }

      // 4. Restore a session for logged-in scraping.
      const session = (await deps.sessionStore?.get(platform)) ?? undefined;

      // 5. Capture.
      let result;
      try {
        result = await deps.engine.capturePage({
          url: input.url,
          purpose: input.purpose,
          maxSteps: input.policy.max_steps,
          settleMs,
          proxyUrl,
          session,
          redact: input.policy.redact_sensitive,
          captureScreenshot: input.policy.capture_screenshot,
        });
      } catch (error) {
        deps.circuitBreaker?.onFailure(platform);
        if (proxyId) deps.proxyPool?.report(proxyId, false);
        throw error;
      }

      // 6. Verification wall → queue a human handoff and stop (never bypass).
      if (result.challenge) {
        deps.circuitBreaker?.onFailure(platform);
        if (proxyId) deps.proxyPool?.report(proxyId, false);
        let handoffId: string | undefined;
        if (deps.handoff) {
          const req = await deps.handoff.enqueue({
            platform,
            url: input.url,
            reason: `Verification challenge during ${input.purpose}`,
          });
          handoffId = req.id;
        }
        throw new ScrapeChallengeError(platform, input.url, handoffId);
      }

      // 7. Success — report health and refresh the session.
      deps.circuitBreaker?.onSuccess(platform);
      if (proxyId) deps.proxyPool?.report(proxyId, true);
      if (result.cookies !== undefined && deps.sessionStore) {
        await deps.sessionStore
          .save(platform, {
            cookies: result.cookies,
            user_agent: session?.user_agent,
            locale: session?.locale,
            timezone_id: session?.timezone_id,
            meta: session?.meta,
          })
          .catch(() => undefined);
      }

      // 8. Persist a screenshot if captured (relative path; not served publicly).
      let screenshotPath: string | undefined;
      if (result.screenshot) {
        try {
          await mkdir(screenshotDir, { recursive: true });
          const name = `${input.purpose}-${createHash("sha256").update(result.url).digest("hex").slice(0, 12)}.png`;
          const abs = join(screenshotDir, name);
          await writeFile(abs, result.screenshot);
          screenshotPath = relative(process.cwd(), abs);
        } catch {
          /* screenshot persistence is best-effort */
        }
      }

      return {
        url: result.url || input.url,
        title: result.title,
        text: result.text,
        links: result.links,
        screenshot_path: screenshotPath,
        captured_at: new Date(now()).toISOString(),
        scan: result.scan,
      };
    },
  };
}
