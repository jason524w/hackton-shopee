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

        const extracted = await evaluatePage(client);
        const screenshotPath = input.policy.capture_screenshot
          ? await captureScreenshot(client, screenshotDir, input.purpose, target.id)
          : undefined;

        return {
          url: extracted.url || input.url,
          title: extracted.title,
          text: input.policy.redact_sensitive ? redactText(extracted.text) : extracted.text,
          links: sanitizeLinks(extracted.links),
          screenshot_path: screenshotPath,
          captured_at: startedAt,
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
      .slice(0, 80)
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
  return output.slice(0, 40);
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
