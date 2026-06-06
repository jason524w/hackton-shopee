import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import sampleResult from "../../../contract/fixtures/sample-result.json";
import { useAppStore } from "./store";

function stubFetchOk() {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      status: 200,
      json: async () => sampleResult,
    })),
  );
}

function stubFetchError(status = 503) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: false,
      status,
      json: async () => ({ status: "not_configured", message: "OPENAI_API_KEY is not set." }),
    })),
  );
}

describe("app store", () => {
  beforeEach(() => useAppStore.getState().reset());
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
    stubFetchOk();
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

  it("startRun surfaces pipeline errors instead of falling back to canned data", async () => {
    stubFetchError();
    await useAppStore.getState().startRun();
    const s = useAppStore.getState();
    expect(s.runStatus).toBe("error");
    expect(s.runError).toMatch(/OPENAI_API_KEY/);
    expect(s.opportunities).toEqual([]);
  });

  it("selectProduct only yields packaging/listing for the opportunity with full detail", async () => {
    stubFetchOk();
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
