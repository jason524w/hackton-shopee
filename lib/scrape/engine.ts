import type { BrowserRetrievalPurpose } from "../providers/browser-retrieval/types";
import type { ScrapeSession } from "./session-store";

/**
 * The low-level browser primitive the managed controller drives. A ScrapeEngine knows how to
 * open one page (through an optional proxy, with an optional restored session), scroll/scan
 * it, and return normalized text + links + (refreshed) cookies — plus a `challenge` flag if a
 * verification wall was detected. This is exactly the surface a Playwright (or CDP) adapter
 * implements, and it's the seam tests inject a fake engine at.
 */

export interface ScrapeEngineInput {
  url: string;
  purpose: BrowserRetrievalPurpose;
  /** Max incremental scroll-capture steps (virtualized list handling). */
  maxSteps: number;
  /** Settle time between steps (ms). */
  settleMs: number;
  /** Proxy URL to route through, if any. */
  proxyUrl?: string;
  /** Session to restore (cookies/UA/locale) for logged-in scraping. */
  session?: ScrapeSession;
  /** Whether to redact emails/phones/secrets from the returned text. */
  redact?: boolean;
  /** Capture a screenshot (stored by the caller, not the engine). */
  captureScreenshot?: boolean;
}

export interface ScrapeEngineResult {
  url: string;
  title: string;
  text: string;
  links: Array<{ label: string; url: string }>;
  /** Incremental scan stats. */
  scan?: { steps: number; reached_end: boolean };
  /** Refreshed cookies/storage state after the visit (to persist into the SessionStore). */
  cookies?: unknown;
  /** PNG screenshot bytes, if requested. */
  screenshot?: Buffer;
  /** True when a verification / login / captcha wall was detected on the page. */
  challenge?: boolean;
}

export interface ScrapeEngine {
  capturePage(input: ScrapeEngineInput): Promise<ScrapeEngineResult>;
  /** Release any held browser resources (best-effort). */
  close?(): Promise<void>;
}
