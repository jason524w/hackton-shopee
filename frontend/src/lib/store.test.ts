import { describe, it, expect, beforeEach } from "vitest";
import { useAppStore } from "./store";

describe("app store", () => {
  beforeEach(() => useAppStore.getState().reset());

  it("starts with no brief and step=brief", () => {
    const s = useAppStore.getState();
    expect(s.brief).toBeNull();
    expect(s.currentStep).toBe("brief");
  });

  it("loadDemoBrief populates the brief", () => {
    useAppStore.getState().loadDemoBrief();
    expect(useAppStore.getState().brief?.keywords).toBe("mini desk vacuum");
  });

  it("startRun advances to company step", () => {
    useAppStore.getState().startRun();
    expect(useAppStore.getState().currentStep).toBe("company");
  });

  it("selectProduct sets selection + packaging + listing", () => {
    useAppStore.getState().selectProduct("mini-desk-vacuum");
    const s = useAppStore.getState();
    expect(s.selectedProductId).toBe("mini-desk-vacuum");
    expect(s.packaging).not.toBeNull();
    expect(s.listing).not.toBeNull();
  });
});
