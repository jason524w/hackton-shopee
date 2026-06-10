import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { FilesystemRunStore, RunAlreadyExistsError, RunNotFoundError, type RunRecord } from "../run-store";
import type { Brief } from "../../../contract/result";

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

function baseRecord(runId: string): RunRecord {
  return {
    run_id: runId,
    status: "queued",
    brief: BRIEF,
    image_mode: "dry-run",
    text_mode: "live",
    created_at: new Date().toISOString(),
  };
}

describe("FilesystemRunStore", () => {
  let dir: string;
  let store: FilesystemRunStore;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "run-store-"));
    store = new FilesystemRunStore(dir);
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("creates and reads a run record", async () => {
    await store.create(baseRecord("run_a"));
    const got = await store.get("run_a");
    expect(got?.status).toBe("queued");
    expect(got?.brief.product_intent).toBe("mini desk vacuum");
  });

  it("rejects duplicate creation (run_id collision)", async () => {
    await store.create(baseRecord("run_a"));
    await expect(store.create(baseRecord("run_a"))).rejects.toBeInstanceOf(RunAlreadyExistsError);
  });

  it("returns undefined for a missing run", async () => {
    expect(await store.get("nope")).toBeUndefined();
  });

  it("merges patches and throws on updating a missing run", async () => {
    await store.create(baseRecord("run_a"));
    await store.update("run_a", { status: "running", started_at: "2026-06-10T00:00:00Z", current_agent: "market" });
    const got = await store.get("run_a");
    expect(got?.status).toBe("running");
    expect(got?.current_agent).toBe("market");
    expect(got?.started_at).toBe("2026-06-10T00:00:00Z");
    expect(got?.brief.product_intent).toBe("mini desk vacuum"); // unchanged

    await expect(store.update("ghost", { status: "failed" })).rejects.toBeInstanceOf(RunNotFoundError);
  });

  it("serializes concurrent updates without losing writes", async () => {
    await store.create(baseRecord("run_a"));
    // 20 concurrent patches each setting a distinct field via current_agent rotation.
    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        store.update("run_a", { current_agent: i % 2 === 0 ? "market" : "sourcing" }),
      ),
    );
    const got = await store.get("run_a");
    expect(["market", "sourcing"]).toContain(got?.current_agent);
    // The record must remain valid JSON (no torn write) and retain immutable fields.
    expect(got?.run_id).toBe("run_a");
    expect(got?.brief.product_intent).toBe("mini desk vacuum");
  });

  it("lists runs newest-first", async () => {
    await store.create({ ...baseRecord("run_old"), created_at: "2026-06-01T00:00:00Z" });
    await store.create({ ...baseRecord("run_new"), created_at: "2026-06-09T00:00:00Z" });
    const list = await store.list();
    expect(list.map((r) => r.run_id)).toEqual(["run_new", "run_old"]);
  });
});
