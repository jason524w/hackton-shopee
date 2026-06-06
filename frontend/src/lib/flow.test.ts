import { describe, it, expect } from "vitest";
import { progressFor, flowKeyForPath, FLOW_STEPS } from "./flow";

describe("flow", () => {
  it("has 5 steps", () => {
    expect(FLOW_STEPS).toHaveLength(5);
  });
  it("progresses 20/40/60/80/100", () => {
    expect(progressFor("brief")).toBe(20);
    expect(progressFor("company")).toBe(40);
    expect(progressFor("listing")).toBe(100);
  });
  it("maps paths to flow keys", () => {
    expect(flowKeyForPath("/app/org-room")).toBe("company");
    expect(flowKeyForPath("/app/org-room/market")).toBe("company");
    expect(flowKeyForPath("/app/dashboard")).toBeNull();
  });
});
