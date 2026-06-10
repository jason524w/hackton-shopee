/**
 * Job queue seam.
 *
 * Decouples "a run was submitted" from "a run is executing". The default implementation
 * is an in-process worker pool with bounded concurrency — correct for a single
 * long-lived Node server (`next start`) running a small team's workload. Durability comes
 * from the RunStore: queued/running state lives there, so a process restart can re-enqueue
 * unfinished runs via `resume()` rather than losing them.
 *
 * The interface is deliberately minimal so a Redis/BullMQ implementation can drop in for
 * multi-instance horizontal scale without changing callers.
 *
 * NOTE (serverless caveat): an in-process queue requires a persistent process. On
 * platforms that freeze/recycle per request (e.g. Vercel lambdas) use a Redis-backed
 * implementation instead. The self-managed Docker (`next start`) deploy this repo targets
 * keeps the process alive, so in-process is fine.
 */

export type JobHandler = (runId: string) => Promise<void>;

export interface JobQueue {
  /** Schedule a run for execution. Resolves once enqueued (NOT once executed). */
  enqueue(runId: string): Promise<void>;
  /** Number of jobs currently executing. */
  activeCount(): number;
  /** Number of jobs waiting for a free worker slot. */
  pendingCount(): number;
  /** Resolves when all queued + active jobs have finished (test/shutdown aid). */
  drain(): Promise<void>;
}

export interface InProcessJobQueueOptions {
  /** Max concurrent runs. Keep small — each run drives the full LLM + scrape pipeline. */
  concurrency?: number;
  /** Called when a job handler throws (the handler is expected to persist failure itself). */
  onError?: (runId: string, error: unknown) => void;
}

export class InProcessJobQueue implements JobQueue {
  private readonly concurrency: number;
  private readonly onError?: (runId: string, error: unknown) => void;
  private readonly waiting: string[] = [];
  private readonly active = new Set<string>();
  private idleResolvers: Array<() => void> = [];

  constructor(
    private readonly handler: JobHandler,
    options: InProcessJobQueueOptions = {},
  ) {
    this.concurrency = Math.max(1, options.concurrency ?? 2);
    this.onError = options.onError;
  }

  async enqueue(runId: string): Promise<void> {
    this.waiting.push(runId);
    this.pump();
  }

  activeCount(): number {
    return this.active.size;
  }

  pendingCount(): number {
    return this.waiting.length;
  }

  drain(): Promise<void> {
    if (this.active.size === 0 && this.waiting.length === 0) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.idleResolvers.push(resolve);
    });
  }

  private pump(): void {
    while (this.active.size < this.concurrency && this.waiting.length > 0) {
      const runId = this.waiting.shift()!;
      this.active.add(runId);
      void this.run(runId);
    }
  }

  private async run(runId: string): Promise<void> {
    try {
      await this.handler(runId);
    } catch (error) {
      this.onError?.(runId, error);
    } finally {
      this.active.delete(runId);
      if (this.active.size === 0 && this.waiting.length === 0) {
        const resolvers = this.idleResolvers;
        this.idleResolvers = [];
        for (const resolve of resolvers) resolve();
      }
      this.pump();
    }
  }
}
