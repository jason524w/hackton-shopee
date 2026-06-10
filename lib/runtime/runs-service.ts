import type { AgentKey, Brief, RunResult } from "../../contract/result";
import { FileAuditSink, createAuditRunId, type AuditSink } from "../agent-runtime/audit";
import { resolveAuditRoot } from "../agents/audit-root";
import { runOrchestration } from "../agents/orchestrate";
import { ContractViolationError } from "../agents/validate-run-result";
import { InProcessJobQueue, type JobQueue } from "./job-queue";
import { FilesystemRunStore, type RunRecord, type RunStore } from "./run-store";

export interface SubmitRunInput {
  brief: Brief;
  /** Optional client-supplied run id (already format-validated). */
  runId?: string;
  imageMode?: "live" | "dry-run";
  textMode?: "live" | "fixture";
}

/** The orchestration call the service drives — matches runOrchestration's relevant surface. */
export type OrchestrationRunner = (
  brief: Brief,
  opts: {
    runId: string;
    imageMode: "live" | "dry-run";
    textMode: "live" | "fixture";
    audit?: AuditSink;
    onAgentStart?: (agentKey: AgentKey) => void;
  },
) => Promise<RunResult>;

export interface RunsServiceOptions {
  store: RunStore;
  /** Injected so tests can drive the lifecycle without OpenAI; defaults to runOrchestration. */
  runner?: OrchestrationRunner;
  /** Per-run audit sink factory; default writes a FileAuditSink under the audit root. */
  auditSinkFactory?: (runId: string) => AuditSink | undefined;
  concurrency?: number;
  makeRunId?: () => string;
  onError?: (runId: string, error: unknown) => void;
}

/**
 * Decouples run submission from execution. `submitRun` persists a queued record and
 * enqueues a job; a background worker runs the orchestration and persists progress
 * (current_agent), the final RunResult, or a failure — so `getRun` works long after the
 * submitting request returned, and unfinished runs can be resumed after a restart.
 */
export class RunsService {
  readonly store: RunStore;
  private readonly runner: OrchestrationRunner;
  private readonly auditSinkFactory: (runId: string) => AuditSink | undefined;
  private readonly makeRunId: () => string;
  private readonly queue: JobQueue;

  constructor(options: RunsServiceOptions) {
    this.store = options.store;
    this.runner = options.runner ?? (runOrchestration as OrchestrationRunner);
    this.auditSinkFactory = options.auditSinkFactory ?? (() => new FileAuditSink(resolveAuditRoot()));
    this.makeRunId = options.makeRunId ?? (() => createAuditRunId("run"));
    this.queue = new InProcessJobQueue((runId) => this.runJob(runId), {
      concurrency: options.concurrency ?? 2,
      onError:
        options.onError ??
        ((runId, error) => console.error(`[runs-service] job ${runId} failed unexpectedly:`, error)),
    });
  }

  /** Create a queued run and schedule it. Returns the run id. Throws RunAlreadyExistsError on id clash. */
  async submitRun(input: SubmitRunInput): Promise<{ runId: string }> {
    const runId = input.runId ?? this.makeRunId();
    const record: RunRecord = {
      run_id: runId,
      status: "queued",
      brief: input.brief,
      image_mode: input.imageMode ?? "live",
      text_mode: input.textMode ?? "live",
      created_at: new Date().toISOString(),
    };
    await this.store.create(record); // throws RunAlreadyExistsError if the id is taken
    await this.queue.enqueue(runId);
    return { runId };
  }

  getRun(runId: string): Promise<RunRecord | undefined> {
    return this.store.get(runId);
  }

  /** Re-enqueue runs left queued/running by a previous process (call once at startup). */
  async resumeIncompleteRuns(): Promise<number> {
    const summaries = await this.store.list(1000);
    const incomplete = summaries.filter((s) => s.status === "queued" || s.status === "running");
    for (const summary of incomplete) {
      await this.queue.enqueue(summary.run_id);
    }
    return incomplete.length;
  }

  /** Test/shutdown aid: resolves when all queued + active jobs have finished. */
  drain(): Promise<void> {
    return this.queue.drain();
  }

  private async runJob(runId: string): Promise<void> {
    const record = await this.store.get(runId);
    if (!record) {
      return; // record vanished (e.g. cleaned up) — nothing to do
    }
    if (record.status === "completed" || record.status === "failed") {
      return; // already terminal (idempotent resume)
    }

    await this.store.update(runId, { status: "running", started_at: new Date().toISOString() });

    try {
      const result = await this.runner(record.brief, {
        runId,
        imageMode: record.image_mode,
        textMode: record.text_mode,
        audit: this.auditSinkFactory(runId),
        onAgentStart: (agentKey) => {
          // best-effort progress; never block or fail the run on a progress write
          void this.store.update(runId, { current_agent: agentKey }).catch(() => undefined);
        },
      });
      await this.store.update(runId, {
        status: "completed",
        result,
        current_agent: undefined,
        finished_at: new Date().toISOString(),
      });
    } catch (error) {
      const kind = error instanceof ContractViolationError ? "contract_violation" : "pipeline_error";
      await this.store.update(runId, {
        status: "failed",
        error: { message: error instanceof Error ? error.message : String(error), kind },
        finished_at: new Date().toISOString(),
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Process-wide singleton (shared by the API route modules)
// ---------------------------------------------------------------------------

const SINGLETON_KEY = Symbol.for("sea-launch.runs-service");
type GlobalWithRuns = typeof globalThis & { [SINGLETON_KEY]?: RunsService };

/**
 * The shared service for the running Node server. In-process queue state lives here, so
 * this must be a true singleton across the API routes (a long-lived `next start` process).
 */
export function getRunsService(): RunsService {
  const g = globalThis as GlobalWithRuns;
  if (!g[SINGLETON_KEY]) {
    const concurrency = Number.parseInt(process.env.RUN_CONCURRENCY ?? "", 10);
    g[SINGLETON_KEY] = new RunsService({
      store: new FilesystemRunStore(resolveAuditRoot()),
      concurrency: Number.isFinite(concurrency) && concurrency > 0 ? concurrency : undefined,
    });
  }
  return g[SINGLETON_KEY]!;
}
