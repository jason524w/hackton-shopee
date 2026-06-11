import type { ScrapeEngine, ScrapeEngineInput, ScrapeEngineResult } from "./engine";

/**
 * Playwright-backed ScrapeEngine — SKELETON.
 *
 * This is the real browser adapter for the managed scrape controller. It is intentionally
 * NOT wired into the default pipeline and `playwright` is NOT a dependency of this repo
 * (it pulls ~300MB of browser binaries). To use it on a self-managed server:
 *
 *   npm i playwright && npx playwright install chromium
 *   BROWSER_RETRIEVAL_MODE=live SCRAPE_ENGINE=playwright
 *
 * Because `playwright` is an optional, dynamically-imported dependency, this module compiles
 * and the repo's tests pass WITHOUT it installed; `createPlaywrightEngine().capturePage()`
 * throws a clear error if Playwright is missing. The incremental-scan / challenge-detection
 * logic mirrors the existing CDP controller (lib/providers/browser-retrieval/chrome.ts) and
 * should be validated against real marketplace pages on the target server — it cannot be
 * verified in a headless CI environment.
 *
 * TODO (server-side validation):
 *  - tune fingerprint (UA/viewport/locale/timezone) per platform
 *  - confirm storageState round-trips logged-in 1688/Taobao/Shopee sessions
 *  - calibrate challenge selectors against live verification walls
 */

const MAX_SCAN_TEXT_LENGTH = 150_000;

// Minimal structural types for the slice of Playwright we use, so this file type-checks
// without the dependency. The real objects come from the dynamic import at runtime.
interface PwBrowser {
  newContext(opts: Record<string, unknown>): Promise<PwContext>;
  close(): Promise<void>;
}
interface PwContext {
  newPage(): Promise<PwPage>;
  storageState(): Promise<unknown>;
  close(): Promise<void>;
}
interface PwPage {
  goto(url: string, opts?: Record<string, unknown>): Promise<unknown>;
  evaluate<T>(fn: string): Promise<T>;
  screenshot(opts?: Record<string, unknown>): Promise<Buffer>;
  waitForTimeout(ms: number): Promise<void>;
  title(): Promise<string>;
  url(): string;
}
interface PwChromium {
  launch(opts: Record<string, unknown>): Promise<PwBrowser>;
}

export interface PlaywrightEngineOptions {
  headless?: boolean;
  navigationTimeoutMs?: number;
  /** Default fingerprint; per-platform tuning is a server-side TODO. */
  userAgent?: string;
  locale?: string;
  timezoneId?: string;
}

async function loadChromium(): Promise<PwChromium> {
  try {
    // Optional dependency, kept out of package.json on purpose. A non-literal specifier
    // stops the bundler/TS from trying to resolve it at build time — it's only needed when
    // SCRAPE_ENGINE=playwright on a host that has installed it.
    const specifier = "playwright";
    const mod = (await import(/* webpackIgnore: true */ specifier)) as { chromium: PwChromium };
    return mod.chromium;
  } catch {
    throw new Error(
      "Playwright is not installed. Run `npm i playwright && npx playwright install chromium` on the scrape host to use SCRAPE_ENGINE=playwright.",
    );
  }
}

export function createPlaywrightEngine(options: PlaywrightEngineOptions = {}): ScrapeEngine {
  const headless = options.headless ?? true;
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 30_000;

  return {
    async capturePage(input: ScrapeEngineInput): Promise<ScrapeEngineResult> {
      const chromium = await loadChromium();
      const browser = await chromium.launch({
        headless,
        proxy: input.proxyUrl ? { server: input.proxyUrl } : undefined,
      });
      try {
        const context = await browser.newContext({
          userAgent: input.session?.user_agent ?? options.userAgent,
          locale: input.session?.locale ?? options.locale,
          timezoneId: input.session?.timezone_id ?? options.timezoneId,
          // Restore a prior logged-in session if present.
          storageState: input.session?.cookies ? (input.session.cookies as object) : undefined,
        });
        try {
          const page = await context.newPage();
          await page.goto(input.url, { waitUntil: "load", timeout: navigationTimeoutMs });
          await page.waitForTimeout(input.settleMs);

          const scan = await incrementalScan(page, input.maxSteps, input.settleMs);
          const challenge = detectChallenge(scan.text, await page.title());
          const screenshot = input.captureScreenshot ? await page.screenshot({ fullPage: false }) : undefined;
          const cookies = await context.storageState();

          return {
            url: page.url() || input.url,
            title: await page.title(),
            text: input.redact ? redactText(scan.text) : scan.text,
            links: scan.links,
            scan: { steps: scan.steps, reached_end: scan.reachedEnd },
            cookies,
            screenshot,
            challenge,
          };
        } finally {
          await context.close().catch(() => undefined);
        }
      } finally {
        await browser.close().catch(() => undefined);
      }
    },
  };
}

/**
 * Incremental scroll-and-capture (mirrors the CDP controller): captures visible text after
 * every scroll step so virtualized marketplace lists don't drop rows scrolled out of the DOM.
 * Implemented via page.evaluate so it runs in the page context.
 */
async function incrementalScan(
  page: PwPage,
  maxSteps: number,
  settleMs: number,
): Promise<{ text: string; links: Array<{ label: string; url: string }>; steps: number; reachedEnd: boolean }> {
  const steps = Math.max(1, Math.min(maxSteps, 16));
  const chunks: string[] = [];
  const seen = new Set<string>();
  const links = new Map<string, { label: string; url: string }>();
  let reachedEnd = false;
  let performed = 0;

  for (let i = 0; i < steps; i += 1) {
    performed = i + 1;
    const snap = await page.evaluate<{
      text: string;
      links: Array<{ label: string; url: string }>;
      atBottom: boolean;
    }>(`(() => {
      const text = document.body ? document.body.innerText : "";
      const links = Array.from(document.querySelectorAll("a[href]")).slice(0, 200).map((n) => ({
        label: (n.textContent || "").replace(/\\s+/g, " ").trim().slice(0, 160),
        url: n.href,
      })).filter((l) => l.label && l.url);
      window.scrollBy(0, Math.max(window.innerHeight * 0.8, 600));
      const doc = document.documentElement;
      const atBottom = window.scrollY + window.innerHeight >= Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0) - 4;
      return { text: text.slice(0, 25000), links, atBottom };
    })()`);

    if (snap.text && !seen.has(snap.text)) {
      seen.add(snap.text);
      chunks.push(snap.text);
    }
    for (const l of snap.links) if (l.url && !links.has(l.url)) links.set(l.url, l);
    if (chunks.join("\n").length >= MAX_SCAN_TEXT_LENGTH) break;
    if (snap.atBottom) {
      reachedEnd = true;
      break;
    }
    await page.waitForTimeout(Math.max(300, Math.min(settleMs, 3000)));
  }

  return {
    text: chunks.join("\n").slice(0, MAX_SCAN_TEXT_LENGTH),
    links: Array.from(links.values()),
    steps: performed,
    reachedEnd,
  };
}

function detectChallenge(text: string, title: string): boolean {
  const haystack = `${title}\n${text}`.trim();
  const strong = /验证码|安全验证|人机验证|滑块|captcha|拖动.*验证|unusual traffic|ensure normal access/i;
  return strong.test(haystack) && haystack.length < 8000;
}

function redactText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\+?\d[\s-]?){8,}\b/g, "[redacted-phone]");
}
