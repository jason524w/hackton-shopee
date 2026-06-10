import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import mockResult from "../../../contract/fixtures/sample-result.json";
import type { Brief, RunResult } from "../../../contract/result";
import { FilesystemRunStore } from "../run-store";
import { RunsService, type OrchestrationRunner } from "../runs-service";

const BRIEF: Brief = {
  target_market: "Singapore",
  target_platform: "Shopee",
  seller_type: "light-asset",
  product_intent: "mini desk vacuum",
  category: "home",
  budget: 500,
  target_margin: 0.25,
  max_fulfillment_days: 10,
  risk_appetite: "balanced",
  language: "en",
};

describe("RunsService", () => {
  let dir: string;
  let store: FilesystemRunStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "runs-svc-"));
    store = new FilesystemRunStore(dir);
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("submits queued, runs in background, reports progress, and persists the result", async () => {
    const progress: string[] = [];
    const runner: OrchestrationRunner = async (brief, opts) => {
      expect(brief.product_intent).toBe("mini desk vacuum");
      opts.onAgentStart?.("market");
      opts.onAgentStart?.("committee");
      // let progress writes flush
      await new Promise((r) => setTimeout(r, 5));
      return mockResult as unknown as RunResult;
    };
    const service = new RunsService({ store, runner, makeRunId: () => "run_test1", auditSinkFactory: () => undefined });

    const { runId } = await service.submitRun({ brief: BRIEF, imageMode: "dry-run" });
    expect(runId).toBe("run_test1");
    expect((await service.getRun(runId))?.status).toBe("queued");

    await service.drain();

    const done = await service.getRun(runId);
    expect(done?.status).toBe("completed");
    expect(done?.result?.run_id).toBe((mockResult as { run_id: string }).run_id);
    expect(done?.finished_at).toBeTruthy();
    expect(done?.current_agent).toBeUndefined(); // cleared on completion
  });

  it("persists failure (kind=pipeline_error) when the runner throws", async () => {
    const runner: OrchestrationRunner = async () => {
      throw new Error("openai exploded");
    };
    const service = new RunsService({ store, runner, makeRunId: () => "run_fail", auditSinkFactory: () => undefined });

    await service.submitRun({ brief: BRIEF });
    await service.drain();

    const rec = await service.getRun("run_fail");
    expect(rec?.status).toBe("failed");
    expect(rec?.error?.kind).toBe("pipeline_error");
    expect(rec?.error?.message).toMatch(/openai exploded/);
  });

  it("rejects a duplicate run_id submission", async () => {
    const runner: OrchestrationRunner = async () => mockResult as unknown as RunResult;
    const service = new RunsService({ store, runner, auditSinkFactory: () => undefined });

    await service.submitRun({ brief: BRIEF, runId: "run_dup" });
    await expect(service.submitRun({ brief: BRIEF, runId: "run_dup" })).rejects.toThrow(/already exists/i);
    await service.drain();
  });

  it("resumes incomplete runs left by a previous process", async () => {
    // Simulate a record persisted as "running" before a restart (no job in the queue).
    await store.create({
      run_id: "run_resume",
      status: "running",
      brief: BRIEF,
      image_mode: "dry-run",
      text_mode: "live",
      created_at: new Date().toISOString(),
      started_at: new Date().toISOString(),
    });

    let ran = false;
    const runner: OrchestrationRunner = async () => {
      ran = true;
      return mockResult as unknown as RunResult;
    };
    const service = new RunsService({ store, runner, auditSinkFactory: () => undefined });

    const resumed = await service.resumeIncompleteRuns();
    expect(resumed).toBe(1);
    await service.drain();

    expect(ran).toBe(true);
    expect((await service.getRun("run_resume"))?.status).toBe("completed");
  });
});
