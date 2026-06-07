import { describe, expect, it } from "vitest";
import sampleResult from "../../../contract/fixtures/sample-result.json";
import type { RunResult } from "../../../contract/result";
import { toBoardSummary, toBrief, toDepartments, toListing, toOpportunities, toPackaging } from "./adapters";
import { DEMO_BRIEF } from "./static-content";

const run = sampleResult as unknown as RunResult;

describe("adapters", () => {
  it("toBrief maps the view brief onto the contract Brief", () => {
    const brief = toBrief(DEMO_BRIEF);
    expect(brief.target_market).toBe("Singapore");
    expect(brief.target_platform).toBe("Shopee");
    expect(brief.budget).toBe(500);
    expect(brief.target_margin).toBeCloseTo(0.3);
    expect(brief.risk_appetite).toBe("balanced");
    expect(brief.language).toBe("en");
  });

  it("toDepartments yields all seven departments with live statuses", () => {
    const departments = toDepartments(run);
    expect(departments.map((d) => d.id)).toEqual([
      "market",
      "sourcing",
      "margin",
      "risk",
      "listing",
      "packaging",
      "committee",
    ]);
    for (const dept of departments) {
      expect(["waiting", "running", "complete", "blocked", "review"]).toContain(dept.status);
    }
  });

  it("toOpportunities maps decisions and money fields", () => {
    const opportunities = toOpportunities(run);
    expect(opportunities.length).toBe(run.opportunities.length);
    for (const opp of opportunities) {
      expect(["go", "watch", "reject"]).toContain(opp.decision);
      expect(opp.sourcePrice).toMatch(/^\w+ \d/);
    }
  });

  it("toPackaging/toListing read the selected listing", () => {
    const packaging = toPackaging(run);
    const listing = toListing(run);
    expect(packaging.productId).toBe(run.selected_listing.opportunity_id);
    expect(packaging.localizedShopeeTitle).toBe(run.selected_listing.shopee.item_name);
    expect(listing.fields.length).toBeGreaterThan(5);
    expect(listing.preview.title).toBe(run.selected_listing.shopee.item_name);
  });

  it("applyAuditStatuses lights departments up progressively", async () => {
    const { applyAuditStatuses, toDepartments } = await import("./adapters");
    const base = toDepartments(run).map((d) => ({ ...d, status: "waiting" as const }));

    const none = applyAuditStatuses(base, []);
    expect(none[0].status).toBe("running"); // market starts first
    expect(none[1].status).toBe("waiting");

    const mid = applyAuditStatuses(base, [
      { agent_key: "market", status: "completed" },
      { agent_key: "sourcing", status: "completed" },
    ]);
    expect(mid[0].status).toBe("complete");
    expect(mid[1].status).toBe("complete");
    expect(mid[2].status).toBe("running"); // margin is next
    expect(mid[3].status).toBe("waiting");

    const failed = applyAuditStatuses(base, [{ agent_key: "market", status: "failed" }]);
    expect(failed[0].status).toBe("blocked");
  });

  it("toBoardSummary counts decisions from the run", () => {
    const summary = toBoardSummary(run);
    expect(summary.found).toBe(run.opportunities.length);
    expect(summary.go + summary.watch + summary.reject).toBe(summary.found);
  });
});
