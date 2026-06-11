import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sampleResult from "../../../contract/fixtures/sample-result.json";
import { useAppStore } from "./store";

// Install a controllable, Map-backed localStorage on window before each test. This works
// across both environments this file runs in — node (root `npm test`, no window) and jsdom
// (frontend's own vitest config, whose localStorage lacks usable methods here) — so the
// refresh-recovery path is exercised deterministically.
function installFakeLocalStorage(): void {
  const mem = new Map<string, string>();
  const localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  };
  const g = globalThis as { window?: { localStorage?: unknown } };
  if (typeof g.window === "undefined") g.window = {};
  Object.defineProperty(g.window, "localStorage", { value: localStorage, configurable: true, writable: true });
}

function jsonResponse(body: unknown, ok = true, status = 200) {
  return { ok, status, json: async () => body };
}

// Routes the async flow: POST /api/runs (enqueue) → GET /api/runs/:id (status) → audit.
function stubAsyncOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init?: RequestInit) => {
      if (init?.method === "POST" && url.includes("/api/runs")) {
        return jsonResponse({ status: "queued", run_id: "run_test" }, true, 202);
      }
      if (url.includes("/audit")) {
        return jsonResponse({ agents: [] });
      }
      // GET /api/runs/:id status → completed with the result on the first poll.
      return jsonResponse({ run_id: "run_test", status: "completed", result: sampleResult });
    }),
  );
}

// Enqueue rejects (e.g. missing OPENAI_API_KEY → 503 from POST /api/runs).
function stubSubmitError(status = 503) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => jsonResponse({ status: "not_configured", message: "OPENAI_API_KEY is not set." }, false, status)),
  );
}

describe("app store", () => {
  beforeEach(() => {
    installFakeLocalStorage();
    useAppStore.getState().reset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("starts with no brief, idle run and step=brief", () => {
    const s = useAppStore.getState();
    expect(s.brief).toBeNull();
    expect(s.runStatus).toBe("idle");
    expect(s.currentStep).toBe("brief");
    expect(s.opportunities).toEqual([]);
  });

  it("loadDemoBrief populates the brief", () => {
    useAppStore.getState().loadDemoBrief();
    expect(useAppStore.getState().brief?.keywords).toBe("mini desk vacuum");
  });

  it("startRun advances to company step and fills state from the live RunResult", async () => {
    stubAsyncOk();
    const run = useAppStore.getState().startRun();
    expect(useAppStore.getState().currentStep).toBe("company");
    expect(useAppStore.getState().runStatus).toBe("running");
    await run;

    const s = useAppStore.getState();
    expect(s.runStatus).toBe("done");
    expect(s.opportunities.length).toBeGreaterThan(0);
    expect(s.departments.some((d) => d.status === "complete")).toBe(true);
    expect(s.boardSummary?.found).toBe(s.opportunities.length);
    expect(s.packaging).not.toBeNull();
    expect(s.listing).not.toBeNull();
  });

  it("startRun surfaces enqueue errors instead of falling back to canned data", async () => {
    stubSubmitError();
    await useAppStore.getState().startRun();
    const s = useAppStore.getState();
    expect(s.runStatus).toBe("error");
    expect(s.runError).toMatch(/OPENAI_API_KEY/);
    expect(s.opportunities).toEqual([]);
  });

  it("resumeActiveRun re-attaches to a persisted in-flight run and hydrates on completion", async () => {
    stubAsyncOk();
    window.localStorage.setItem("sealaunch.activeRunId", "run_test");

    await useAppStore.getState().resumeActiveRun();

    const s = useAppStore.getState();
    expect(s.runStatus).toBe("done");
    expect(s.opportunities.length).toBeGreaterThan(0);
    expect(window.localStorage.getItem("sealaunch.activeRunId")).toBeNull(); // cleared on completion
  });

  it("resumeActiveRun is a no-op with no persisted run", async () => {
    window.localStorage.removeItem("sealaunch.activeRunId");
    await useAppStore.getState().resumeActiveRun();
    expect(useAppStore.getState().runStatus).toBe("idle");
  });

  it("selectProduct only yields packaging/listing for the opportunity with full detail", async () => {
    stubAsyncOk();
    await useAppStore.getState().startRun();
    const s = useAppStore.getState();
    const primaryId = s.runResult!.selected_listing.opportunity_id;

    useAppStore.getState().selectProduct(primaryId);
    expect(useAppStore.getState().packaging?.productId).toBe(primaryId);

    const other = s.opportunities.find((o) => o.id !== primaryId);
    if (other) {
      useAppStore.getState().selectProduct(other.id);
      expect(useAppStore.getState().packaging).toBeNull();
    }
  });
});
