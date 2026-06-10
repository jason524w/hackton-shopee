import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type {
  BrowserController,
  BrowserControllerSnapshot,
  BrowserRetrievalPolicy,
  BrowserRetrievalPurpose,
} from "./types";

interface ChromeTarget {
  id: string;
  webSocketDebuggerUrl: string;
}

interface ChromeEvaluateValue {
  url: string;
  title: string;
  text: string;
  links: Array<{ label: string; url: string }>;
}

interface CdpResponse {
  id?: number;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: { message?: string; data?: unknown };
}

export interface CdpChromeControllerOptions {
  endpoint?: string;
  navigationTimeoutMs?: number;
  settleMs?: number;
  screenshotDir?: string;
}

export function createCdpChromeBrowserController(
  options: CdpChromeControllerOptions = {},
): BrowserController {
  const endpoint = (options.endpoint ?? process.env.CHROME_CDP_ENDPOINT ?? "http://127.0.0.1:9222").replace(/\/$/, "");
  const navigationTimeoutMs = options.navigationTimeoutMs ?? 20_000;
  const settleMs = options.settleMs ?? 1_500;
  const screenshotDir = options.screenshotDir ?? join(process.cwd(), "public", "generated", "browser-snapshots");

  return {
    async capture(input: {
      url: string;
      purpose: BrowserRetrievalPurpose;
      policy: BrowserRetrievalPolicy;
    }): Promise<BrowserControllerSnapshot> {
      const startedAt = new Date().toISOString();
      const target = await createTarget(endpoint, "about:blank");
      const client = await CdpClient.connect(target.webSocketDebuggerUrl);

      try {
        await client.send("Page.enable");
        await client.send("Runtime.enable");
        await navigate(client, input.url, navigationTimeoutMs);
        await sleep(settleMs);

        const scanned = await scanPage(client, input.policy.max_steps, settleMs);
        const screenshotPath = input.policy.capture_screenshot
          ? await captureScreenshot(client, screenshotDir, input.purpose, target.id)
          : undefined;

        return {
          url: scanned.url || input.url,
          title: scanned.title,
          text: input.policy.redact_sensitive ? redactText(scanned.text) : scanned.text,
          links: sanitizeLinks(scanned.links),
          screenshot_path: screenshotPath,
          captured_at: startedAt,
          scan: { steps: scanned.steps, reached_end: scanned.reachedEnd },
        };
      } finally {
        client.close();
        await closeTarget(endpoint, target.id).catch(() => undefined);
      }
    },
  };
}

async function createTarget(endpoint: string, url: string): Promise<ChromeTarget> {
  const encodedUrl = encodeURIComponent(url);
  const response = await fetch(`${endpoint}/json/new?${encodedUrl}`, { method: "PUT" }).catch(() =>
    fetch(`${endpoint}/json/new?${encodedUrl}`),
  );
  if (!response.ok) {
    throw new Error(`Chrome CDP create target failed: ${response.status} ${await response.text()}`);
  }

  const target = (await response.json()) as Partial<ChromeTarget>;
  if (!target.id || !target.webSocketDebuggerUrl) {
    throw new Error(`Chrome CDP target missing websocket URL: ${JSON.stringify(target)}`);
  }
  return { id: target.id, webSocketDebuggerUrl: target.webSocketDebuggerUrl };
}

async function closeTarget(endpoint: string, targetId: string): Promise<void> {
  await fetch(`${endpoint}/json/close/${targetId}`);
}

async function navigate(client: CdpClient, url: string, timeoutMs: number): Promise<void> {
  const load = client.waitForEvent("Page.loadEventFired", timeoutMs).catch(() => undefined);
  await client.send("Page.navigate", { url });
  await load;
}

async function evaluatePage(client: CdpClient): Promise<ChromeEvaluateValue> {
  const expression = `(() => {
    const visibleText = document.body ? document.body.innerText : "";
    const links = Array.from(document.querySelectorAll("a[href]"))
      .slice(0, 200)
      .map((node) => ({
        label: (node.textContent || node.getAttribute("aria-label") || "").replace(/\\s+/g, " ").trim().slice(0, 160),
        url: new URL(node.getAttribute("href"), location.href).href
      }))
      .filter((link) => link.label && link.url);
    return {
      url: location.href,
      title: document.title || "",
      text: visibleText
        .replace(/[ \\t]+/g, " ")
        .replace(/\\n{3,}/g, "\\n\\n")
        .trim()
        .slice(0, 25000),
      links
    };
  })()`;

  const result = await client.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  const root = asRecord(result);
  const remoteResult = asRecord(root.result);
  const value = asRecord(remoteResult.value) as unknown as ChromeEvaluateValue;
  if (!value || typeof value !== "object") {
    throw new Error(`Chrome page evaluation returned no object: ${JSON.stringify(result)}`);
  }
  return {
    url: String(value.url ?? ""),
    title: String(value.title ?? ""),
    text: String(value.text ?? ""),
    links: Array.isArray(value.links) ? value.links : [],
  };
}

interface PageScanResult {
  url: string;
  title: string;
  text: string;
  links: Array<{ label: string; url: string }>;
  steps: number;
  reachedEnd: boolean;
}

const MAX_SCAN_TEXT_LENGTH = 150_000;

/**
 * Incremental scan: capture visible text after EVERY scroll step instead of once at the end.
 * Marketplace search pages (Shopee/Taobao/1688) virtualize their lists — rows scrolled past are
 * removed from the DOM, so a single end-state innerText capture silently drops earlier rows.
 * Each step's capture is accumulated (identical captures deduped by hash) and lazy loading is
 * awaited adaptively (poll for scrollHeight growth) rather than with a blind fixed sleep.
 */
async function scanPage(client: CdpClient, maxSteps: number, settleMs: number): Promise<PageScanResult> {
  const steps = Math.max(1, Math.min(maxSteps, 16));
  const stepTexts: string[] = [];
  const stepHashes = new Set<string>();
  const links = new Map<string, { label: string; url: string }>();
  let url = "";
  let title = "";
  let reachedEnd = false;
  let performedSteps = 0;

  const accumulate = (extracted: ChromeEvaluateValue): void => {
    url = extracted.url || url;
    title = extracted.title || title;
    const hash = createHash("sha256").update(extracted.text).digest("hex");
    if (extracted.text && !stepHashes.has(hash)) {
      stepHashes.add(hash);
      stepTexts.push(extracted.text);
    }
    for (const link of extracted.links) {
      if (link.url && !links.has(link.url)) {
        links.set(link.url, link);
      }
    }
  };

  for (let step = 0; step < steps; step += 1) {
    performedSteps = step + 1;
    accumulate(await evaluatePage(client));

    if (totalLength(stepTexts) >= MAX_SCAN_TEXT_LENGTH) {
      break;
    }

    const position = await scrollOnce(client);
    if (position.atBottom) {
      // Bottom of the current page height — wait to see whether lazy loading extends it.
      const grew = await waitForHeightGrowth(client, position.height, Math.max(settleMs, 1_200));
      if (!grew) {
        accumulate(await evaluatePage(client));
        reachedEnd = true;
        break;
      }
    } else {
      await waitForHeightGrowth(client, position.height, Math.max(500, Math.min(settleMs, 3_000)));
    }
  }

  return {
    url,
    title,
    text: stepTexts.join("\n").slice(0, MAX_SCAN_TEXT_LENGTH),
    links: Array.from(links.values()),
    steps: performedSteps,
    reachedEnd,
  };
}

async function scrollOnce(client: CdpClient): Promise<{ atBottom: boolean; height: number }> {
  const result = await client.send("Runtime.evaluate", {
    expression: `(() => {
      window.scrollBy(0, Math.max(window.innerHeight * 0.8, 600));
      const doc = document.documentElement;
      return {
        scrollY: window.scrollY,
        viewport: window.innerHeight,
        height: Math.max(doc.scrollHeight, document.body ? document.body.scrollHeight : 0)
      };
    })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  const value = asRecord(asRecord(asRecord(result).result).value);
  const scrollY = Number(value.scrollY ?? 0);
  const viewport = Number(value.viewport ?? 0);
  const height = Number(value.height ?? 0);
  return { atBottom: height > 0 && scrollY + viewport >= height - 4, height };
}

/** Poll until the document grows past `baseline` (lazy-loaded content arrived) or the timeout passes. */
async function waitForHeightGrowth(client: CdpClient, baseline: number, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(250);
    const result = await client.send("Runtime.evaluate", {
      expression: `Math.max(document.documentElement.scrollHeight, document.body ? document.body.scrollHeight : 0)`,
      returnByValue: true,
    });
    const height = Number(asRecord(asRecord(result).result).value ?? 0);
    if (height > baseline + 4) {
      return true;
    }
  }
  return false;
}

function totalLength(parts: string[]): number {
  return parts.reduce((sum, part) => sum + part.length, 0);
}

async function captureScreenshot(
  client: CdpClient,
  screenshotDir: string,
  purpose: BrowserRetrievalPurpose,
  targetId: string,
): Promise<string> {
  await mkdir(screenshotDir, { recursive: true });
  const response = await client.send("Page.captureScreenshot", {
    format: "png",
    captureBeyondViewport: false,
  });
  const data = String(asRecord(response).data ?? "");
  if (!data) {
    throw new Error("Chrome screenshot response did not include image data.");
  }
  const fileName = `${purpose}-${targetId.slice(0, 8)}.png`;
  const outputPath = join(screenshotDir, fileName);
  await writeFile(outputPath, Buffer.from(data, "base64"));
  return outputPath;
}

function sanitizeLinks(links: Array<{ label: string; url: string }>): Array<{ label: string; url: string }> {
  const seen = new Set<string>();
  const output: Array<{ label: string; url: string }> = [];
  for (const link of links) {
    if (!link.label || !link.url || seen.has(link.url)) {
      continue;
    }
    seen.add(link.url);
    output.push({
      label: redactText(link.label),
      url: link.url,
    });
  }
  return output.slice(0, 120);
}

function redactText(text: string): string {
  return text
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[redacted-email]")
    .replace(/\b(?:\+?\d[\s-]?){8,}\b/g, "[redacted-phone]")
    .replace(/\b(?:password|token|cookie|authorization)\s*[:=]\s*\S+/gi, "$1=[redacted]");
}

class CdpClient {
  private sequence = 0;
  private readonly pending = new Map<
    number,
    {
      resolve: (value: unknown) => void;
      reject: (error: Error) => void;
    }
  >();
  private readonly eventWaiters = new Map<string, Array<(message: CdpResponse) => void>>();

  private constructor(private readonly socket: WebSocket) {
    this.socket.addEventListener("message", (event) => {
      const message = JSON.parse(String(event.data)) as CdpResponse;
      if (typeof message.id === "number") {
        const pending = this.pending.get(message.id);
        if (!pending) {
          return;
        }
        this.pending.delete(message.id);
        if (message.error) {
          pending.reject(new Error(message.error.message ?? "Chrome CDP command failed"));
        } else {
          pending.resolve(message.result ?? {});
        }
        return;
      }

      if (message.method) {
        const waiters = this.eventWaiters.get(message.method) ?? [];
        this.eventWaiters.delete(message.method);
        for (const resolve of waiters) {
          resolve(message);
        }
      }
    });

    this.socket.addEventListener("error", () => {
      for (const pending of this.pending.values()) {
        pending.reject(new Error("Chrome CDP websocket error"));
      }
      this.pending.clear();
    });
  }

  static async connect(webSocketUrl: string): Promise<CdpClient> {
    const socket = new WebSocket(webSocketUrl);
    await new Promise<void>((resolve, reject) => {
      socket.addEventListener("open", () => resolve(), { once: true });
      socket.addEventListener("error", () => reject(new Error("Chrome CDP websocket failed to open")), { once: true });
    });
    return new CdpClient(socket);
  }

  send(method: string, params?: Record<string, unknown>): Promise<unknown> {
    const id = ++this.sequence;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.socket.send(payload);
    });
  }

  waitForEvent(method: string, timeoutMs: number): Promise<CdpResponse> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const waiters = this.eventWaiters.get(method) ?? [];
        this.eventWaiters.set(
          method,
          waiters.filter((waiter) => waiter !== onEvent),
        );
        reject(new Error(`Timed out waiting for Chrome CDP event ${method}`));
      }, timeoutMs);

      const onEvent = (message: CdpResponse) => {
        clearTimeout(timer);
        resolve(message);
      };

      const waiters = this.eventWaiters.get(method) ?? [];
      waiters.push(onEvent);
      this.eventWaiters.set(method, waiters);
    });
  }

  close(): void {
    this.socket.close();
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {};
}
