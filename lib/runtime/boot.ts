/**
 * Server boot hook: re-enqueue runs left queued/running when the process last stopped, so
 * a restart doesn't silently strand them. Triggered once when the RunsService singleton is
 * first built (a server-only, Node-runtime path — avoids edge bundling of node: imports).
 *
 * Idempotent within a process. Skips when there's no OPENAI_API_KEY — the pipeline can't
 * run without it, so leave the records queued for a later boot that has the key configured
 * (rather than marking them all failed).
 */

export interface BootResumeDeps {
  hasKey: () => boolean;
  resume: () => Promise<number>;
  log: (message: string) => void;
  warn: (message: string, error: unknown) => void;
}

let started = false;

export async function resumeRunsOnBoot(deps: BootResumeDeps): Promise<number> {
  if (started) return 0;
  if (!deps.hasKey()) {
    // Don't consume the one-shot guard — a later boot with the key set should still resume.
    deps.log("[boot] OPENAI_API_KEY not set; skipping run resume (records left queued).");
    return 0;
  }
  started = true;
  try {
    const count = await deps.resume();
    if (count > 0) deps.log(`[boot] resumed ${count} incomplete run(s) from a previous process.`);
    return count;
  } catch (error) {
    started = false; // allow a retry on the next trigger
    deps.warn("[boot] failed to resume incomplete runs:", error);
    return 0;
  }
}

/** Test-only: reset the one-shot guard between cases. */
export function __resetBootGuardForTests(): void {
  started = false;
}
