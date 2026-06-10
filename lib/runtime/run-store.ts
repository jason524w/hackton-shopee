import { mkdir, readFile, readdir, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import type { AgentKey, Brief, RunResult } from "../../contract/result";

/**
 * Run lifecycle persistence.
 *
 * This is the seam that lets `/api/runs` decouple "submit" from "execute": a run is
 * created (queued), a background worker picks it up (running), and the final RunResult
 * (or error) is persisted so the client can fetch it later — surviving the original
 * request and process restarts.
 *
 * The default implementation is filesystem-backed (one JSON file per run, next to the
 * audit trail) — zero new infra, fine for a single self-managed server / small team.
 * The interface is intentionally small so a Postgres implementation can drop in behind
 * it for multi-instance scale without touching callers.
 */

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface RunRecord {
  run_id: string;
  status: RunStatus;
  brief: Brief;
  image_mode: "live" | "dry-run";
  text_mode: "live" | "fixture";
  /** The agent currently executing (progress signal for the UI). */
  current_agent?: AgentKey;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  /** Present once status === "completed". */
  result?: RunResult;
  /** Present once status === "failed". */
  error?: { message: string; kind: "contract_violation" | "pipeline_error" };
}

export type RunRecordPatch = Partial<Omit<RunRecord, "run_id" | "brief" | "created_at">>;

export interface RunSummary {
  run_id: string;
  status: RunStatus;
  current_agent?: RunRecord["current_agent"];
  created_at: string;
  finished_at?: string;
}

export interface RunStore {
  /** Create a new run record. Rejects if one already exists for this id. */
  create(record: RunRecord): Promise<void>;
  get(runId: string): Promise<RunRecord | undefined>;
  /** Merge a patch into the existing record. Rejects if the run doesn't exist. */
  update(runId: string, patch: RunRecordPatch): Promise<RunRecord>;
  /** Newest-first list of run summaries (for a history view). */
  list(limit?: number): Promise<RunSummary[]>;
}

export class RunNotFoundError extends Error {
  constructor(runId: string) {
    super(`Run not found: ${runId}`);
    this.name = "RunNotFoundError";
  }
}

export class RunAlreadyExistsError extends Error {
  constructor(runId: string) {
    super(`Run already exists: ${runId}`);
    this.name = "RunAlreadyExistsError";
  }
}

/**
 * Filesystem RunStore. Stores `<root>/<runId>/run.json` so a run record sits alongside
 * its `agents/` audit snapshots. Writes are atomic (temp file + rename) so a concurrent
 * reader never sees a half-written record. A per-run async mutex serializes read-modify-write
 * updates within this process.
 */
export class FilesystemRunStore implements RunStore {
  private readonly locks = new Map<string, Promise<unknown>>();

  constructor(private readonly rootDir: string) {}

  async create(record: RunRecord): Promise<void> {
    await this.withLock(record.run_id, async () => {
      const existing = await this.read(record.run_id);
      if (existing) {
        throw new RunAlreadyExistsError(record.run_id);
      }
      await this.write(record);
    });
  }

  async get(runId: string): Promise<RunRecord | undefined> {
    return this.read(runId);
  }

  async update(runId: string, patch: RunRecordPatch): Promise<RunRecord> {
    return this.withLock(runId, async () => {
      const current = await this.read(runId);
      if (!current) {
        throw new RunNotFoundError(runId);
      }
      const next: RunRecord = { ...current, ...patch };
      await this.write(next);
      return next;
    });
  }

  async list(limit = 50): Promise<RunSummary[]> {
    let entries: string[];
    try {
      entries = await readdir(this.rootDir);
    } catch {
      return [];
    }
    const records: RunRecord[] = [];
    for (const entry of entries) {
      const record = await this.read(entry);
      if (record) {
        records.push(record);
      }
    }
    return records
      .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
      .slice(0, limit)
      .map((r) => ({
        run_id: r.run_id,
        status: r.status,
        current_agent: r.current_agent,
        created_at: r.created_at,
        finished_at: r.finished_at,
      }));
  }

  private runPath(runId: string): string {
    return join(this.rootDir, runId, "run.json");
  }

  private async read(runId: string): Promise<RunRecord | undefined> {
    try {
      const raw = await readFile(this.runPath(runId), "utf8");
      return JSON.parse(raw) as RunRecord;
    } catch {
      return undefined;
    }
  }

  private async write(record: RunRecord): Promise<void> {
    const dir = join(this.rootDir, record.run_id);
    await mkdir(dir, { recursive: true });
    const finalPath = join(dir, "run.json");
    const tmpPath = join(dir, `run.json.tmp-${process.pid}-${Date.now()}`);
    await writeFile(tmpPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
    await rename(tmpPath, finalPath); // atomic on POSIX
  }

  /** Serialize operations per run id within this process (read-modify-write safety). */
  private withLock<T>(runId: string, fn: () => Promise<T>): Promise<T> {
    const prior = this.locks.get(runId) ?? Promise.resolve();
    const next = prior.then(fn, fn);
    this.locks.set(
      runId,
      next.catch(() => undefined),
    );
    return next;
  }
}
