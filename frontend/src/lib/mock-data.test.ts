import { describe, it, expect } from "vitest";
import {
  DEPARTMENTS,
  OPPORTUNITIES,
  BOARD_SUMMARY,
  PACKAGING_TABS,
} from "./mock-data";

describe("mock data", () => {
  it("has the seven departments in order", () => {
    expect(DEPARTMENTS.map((d) => d.id)).toEqual([
      "market",
      "sourcing",
      "margin",
      "risk",
      "listing",
      "packaging",
      "committee",
    ]);
  });
  it("board summary counts match opportunity decisions", () => {
    expect(BOARD_SUMMARY.go).toBe(
      OPPORTUNITIES.filter((o) => o.decision === "go").length,
    );
    expect(BOARD_SUMMARY.found).toBe(OPPORTUNITIES.length);
  });
  it("every opportunity has a valid decision", () => {
    for (const o of OPPORTUNITIES) {
      expect(["go", "watch", "reject"]).toContain(o.decision);
    }
  });
  it("packaging has 12 tabs", () => {
    expect(PACKAGING_TABS).toHaveLength(12);
  });
});
