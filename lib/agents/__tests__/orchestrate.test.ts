import { describe, expect, it } from "vitest";

import mock from "../../../contract/mock-result.json";
import type { Brief } from "../../../contract/result";
import { DEFAULT_BRIEF } from "../../../app/api/run/default-brief";
import { InMemoryAuditSink } from "../../agent-runtime/audit";
import { runOrchestration } from "../orchestrate";
import { CANONICAL_AGENT_ORDER, validateRunResult } from "../validate-run-result";

const brief = mock.brief as Brief;

describe("runOrchestration (fixture mode)", () => {
  it("returns a contract-valid RunResult with the seven agents in canonical order", async () => {
    const result = await runOrchestration(brief, {
      textMode: "fixture",
      imageMode: "dry-run",
      runId: "run_test_001",
      createdAt: "2026-06-06T00:00:00.000Z",
    });

    expect(validateRunResult(result)).toEqual([]);
    expect(result.agents.map((a) => a.key)).toEqual([...CANONICAL_AGENT_ORDER]);
    expect(result.run_id).toBe("run_test_001");
    expect(result.audit_run_id).toBe("run_test_001");
    expect(result.committee.ranked_ids.length).toBeGreaterThan(0);
    expect(result.selected_listing).toBeTruthy();
  });

  it("keeps the primary opportunity coherent across committee and listing for the default brief", async () => {
    // Demo-highlight invariant: the no-body default brief must let the hero product
    // flow through every stage — primary == committee top == the listing we build.
    // Regression guard for a default brief whose max_fulfillment_days hard-filters the primary.
    const result = await runOrchestration(DEFAULT_BRIEF, {
      textMode: "fixture",
      imageMode: "dry-run",
      runId: "run_test_coherence",
    });

    const primary = result.opportunities.find((o) => o.is_primary);
    expect(primary).toBeTruthy();
    expect(result.committee.ranked_ids[0]).toBe(primary!.id);
    expect(result.selected_listing.opportunity_id).toBe(primary!.id);
  });

  it("records audit snapshots for the LLM-backed agents", async () => {
    const audit = new InMemoryAuditSink();
    await runOrchestration(brief, {
      textMode: "fixture",
      imageMode: "dry-run",
      runId: "run_test_002",
      audit,
    });

    const market = await audit.getAgentSnapshot("run_test_002", "market");
    expect(market?.status).toBe("completed");
  });
});
