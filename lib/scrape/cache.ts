import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rename, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";

/**
 * Scrape result cache.
 *
 * Marketplace scraping is slow, failure-prone, and rate-risky: hitting Shopee/1688/Taobao
 * repeatedly for the same query both wastes time and raises the odds of an anti-bot wall.
 * Caching scrape results by (purpose, normalized target) with a TTL means a multi-agent run
 * — and repeated runs on the same product — reuse a capture instead of re-scraping.
 *
 * The default implementation is filesystem-backed (one JSON file per entry), mirroring the
 * RunStore pattern — zero new infra for a single self-managed server. The interface is kept
 * small so a Redis implementation can drop in for a multi-instance scrape cluster (A2).
 */

export interface ScrapeCacheEntry<T> {
  value: T;
  captured_at: string;
  expires_at: string;
}

export interface ScrapeCache {
  /** Returns the cached value if present and unexpired, else undefined. */
  get<T>(key: string): Promise<ScrapeCacheEntry<T> | undefined>;
  /** Store a value under key with a TTL (ms). */
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  /** Remove an entry (best-effort). */
  delete(key: string): Promise<void>;
}

/** Build a stable cache key from a purpose/platform tag and a target (url or query). */
export function scrapeCacheKey(purpose: string, target: string): string {
  // Normalize the target so trivially-different inputs share a cache slot.
  const normalizedTarget = target.trim().toLowerCase().replace(/\s+/g, " ");
  return `${purpose}::${normalizedTarget}`;
}

export class FilesystemScrapeCache implements ScrapeCache {
  constructor(
    private readonly rootDir: string,
    private readonly now: () => number = Date.now,
  ) {}

  async get<T>(key: string): Promise<ScrapeCacheEntry<T> | undefined> {
    const path = this.entryPath(key);
    let raw: string;
    try {
      raw = await readFile(path, "utf8");
    } catch {
      return undefined; // miss
    }
    let entry: ScrapeCacheEntry<T>;
    try {
      entry = JSON.parse(raw) as ScrapeCacheEntry<T>;
    } catch {
      return undefined; // corrupt entry — treat as miss
    }
    if (Date.parse(entry.expires_at) <= this.now()) {
      // Expired — clean up best-effort and report a miss.
      await this.delete(key).catch(() => undefined);
      return undefined;
    }
    return entry;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    const capturedAt = this.now();
    const entry: ScrapeCacheEntry<T> = {
      value,
      captured_at: new Date(capturedAt).toISOString(),
      expires_at: new Date(capturedAt + Math.max(0, ttlMs)).toISOString(),
    };
    await mkdir(this.rootDir, { recursive: true });
    const finalPath = this.entryPath(key);
    const tmpPath = `${finalPath}.tmp-${process.pid}-${capturedAt}`;
    await writeFile(tmpPath, `${JSON.stringify(entry, null, 2)}\n`, "utf8");
    await rename(tmpPath, finalPath); // atomic on POSIX
  }

  async delete(key: string): Promise<void> {
    await unlink(this.entryPath(key)).catch(() => undefined);
  }

  /** Remove every expired entry. Optional housekeeping (not required for correctness). */
  async prune(): Promise<number> {
    let files: string[];
    try {
      files = await readdir(this.rootDir);
    } catch {
      return 0;
    }
    let removed = 0;
    for (const file of files) {
      if (!file.endsWith(".json")) continue;
      try {
        const raw = await readFile(join(this.rootDir, file), "utf8");
        const entry = JSON.parse(raw) as ScrapeCacheEntry<unknown>;
        if (Date.parse(entry.expires_at) <= this.now()) {
          await unlink(join(this.rootDir, file)).catch(() => undefined);
          removed += 1;
        }
      } catch {
        // ignore unreadable/corrupt files
      }
    }
    return removed;
  }

  private entryPath(key: string): string {
    const hash = createHash("sha256").update(key).digest("hex").slice(0, 32);
    return join(this.rootDir, `${hash}.json`);
  }
}
