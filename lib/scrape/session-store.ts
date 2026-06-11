import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

/**
 * Per-platform scrape session store (cookies + fingerprint metadata).
 *
 * Logged-in marketplace scraping (1688 / Taobao / Shopee Seller Centre) needs a persisted
 * session so we don't re-login every capture (which itself trips risk controls). Sessions
 * are keyed by platform (optionally platform + account) and survive process restarts. After
 * a human clears a verification challenge, the refreshed session is saved here for reuse.
 *
 * Default implementation is filesystem-backed; the interface is small so a Redis/DB
 * implementation can drop in for a multi-instance scrape cluster.
 */

export interface ScrapeSession {
  /** Serialized cookies (Playwright storageState-shaped, opaque to the store). */
  cookies: unknown;
  user_agent?: string;
  locale?: string;
  timezone_id?: string;
  /** Free-form metadata (account id, proxy affinity, etc.). */
  meta?: Record<string, unknown>;
  saved_at: string;
}

export interface SessionStore {
  get(key: string): Promise<ScrapeSession | undefined>;
  save(key: string, session: Omit<ScrapeSession, "saved_at">): Promise<ScrapeSession>;
  clear(key: string): Promise<void>;
}

/** In-memory session store (tests / ephemeral single-process use). */
export class InMemorySessionStore implements SessionStore {
  private readonly map = new Map<string, ScrapeSession>();
  constructor(private readonly now: () => number = Date.now) {}

  async get(key: string): Promise<ScrapeSession | undefined> {
    return this.map.get(key);
  }
  async save(key: string, session: Omit<ScrapeSession, "saved_at">): Promise<ScrapeSession> {
    const full: ScrapeSession = { ...session, saved_at: new Date(this.now()).toISOString() };
    this.map.set(key, full);
    return full;
  }
  async clear(key: string): Promise<void> {
    this.map.delete(key);
  }
}

/** Filesystem session store: one JSON file per key under rootDir. */
export class FilesystemSessionStore implements SessionStore {
  constructor(
    private readonly rootDir: string,
    private readonly now: () => number = Date.now,
  ) {}

  async get(key: string): Promise<ScrapeSession | undefined> {
    try {
      const raw = await readFile(this.path(key), "utf8");
      return JSON.parse(raw) as ScrapeSession;
    } catch {
      return undefined;
    }
  }

  async save(key: string, session: Omit<ScrapeSession, "saved_at">): Promise<ScrapeSession> {
    const full: ScrapeSession = { ...session, saved_at: new Date(this.now()).toISOString() };
    await mkdir(this.rootDir, { recursive: true });
    const finalPath = this.path(key);
    const tmpPath = `${finalPath}.tmp-${process.pid}-${this.now()}`;
    await writeFile(tmpPath, `${JSON.stringify(full, null, 2)}\n`, "utf8");
    await rename(tmpPath, finalPath);
    return full;
  }

  async clear(key: string): Promise<void> {
    await unlink(this.path(key)).catch(() => undefined);
  }

  private path(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);
    return join(this.rootDir, `${hash}.session.json`);
  }
}
