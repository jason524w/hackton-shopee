// Pipeline orchestrator for /api/run (TASK-API-INTEGRATION #15).
//
// Assembles the 7 agents over the #23 seam (runPipeline) into a single live run,
// threading run mode + audit through each agent and producing a contract-valid
// RunResult. Heterogeneous agent shapes are normalised here:
//   - market / sourcing / listing  → mode-aware runXAgent(...) wrappers
//   - margin / risk                → deterministic Agent consts (no LLM, no mode)
//   - packaging                    → image-mode-aware wrapper
//   - committee                    → STUB (swap import when TASK-COMMITTEE #14 lands)
//
// Execution order puts risk LAST so it aggregates every checkpoint; the returned
// agents[] is then re-sorted to the canonical contract order.

import type { Brief, Committee, RunResult, SelectedListing } from "../../contract/result";
import { createAuditRunId, type AuditSink } from "../agent-runtime/audit";
import type { AgentRunMode } from "../agent-runtime/run-agent";
import {
  createSeedBrowserRetrievalProvider,
  createSeedFxProvider,
  createSeedOpenAIImageProvider,
  createSeedShippingProvider,
  createSeedShopeeProvider,
  createSeedSourcing1688Provider,
} from "../providers";
// #15 stub — swap to `from "./committee"` once TASK-COMMITTEE (#14) lands, then delete committee-stub.ts.
import { committeeAgent } from "./committee-stub";
import { type Agent, type AgentContext, type AgentProviders, runPipeline } from "./contracts";
import { runListingAgent } from "./listing";
import { marginAgent } from "./margin";
import { runMarketAgent, toMarketRunResultSlice } from "./market";
import { runPackagingAgent } from "./packaging";
import { createRiskSupervisor, riskAgent } from "./risk";
import {
  primaryOpportunityToDirection,
  runSourcingAgent,
  toSourcingRunResultSlice,
} from "./sourcing";
import { assertValidRunResult, CANONICAL_AGENT_ORDER } from "./validate-run-result";

/** Where FileAuditSink persists per-agent snapshots; read back by GET /api/runs/:id/audit. */
export const AUDIT_ROOT_DIR = ".runs";

export interface OrchestrationOptions {
  /** Text agents (market/sourcing/listing): "live" calls OpenAI, "fixture" uses seed data. */
  textMode?: AgentRunMode;
  /** Packaging images: "live" generates, "dry-run" returns seed/placeholder assets. */
  imageMode?: "live" | "dry-run";
  audit?: AuditSink;
  runId?: string;
  currency?: string;
  /** Injectable clock for deterministic tests; defaults to wall-clock at call time. */
  createdAt?: string;
  /** Injectable providers for tests; defaults to seed-backed providers. */
  providers?: AgentProviders;
}

export function createSeedProviders(): AgentProviders {
  return {
    shopee: createSeedShopeeProvider(),
    sourcing1688: createSeedSourcing1688Provider(),
    shipping: createSeedShippingProvider(),
    fx: createSeedFxProvider(),
    openaiImage: createSeedOpenAIImageProvider(),
    browser: createSeedBrowserRetrievalProvider(),
  };
}

function orderAgents(agents: RunResult["agents"]): RunResult["agents"] {
  const byKey = new Map(agents.map((a) => [a.key, a]));
  return CANONICAL_AGENT_ORDER.map((key) => byKey.get(key)).filter(
    (a): a is RunResult["agents"][number] => Boolean(a),
  );
}

export async function runOrchestration(
  brief: Brief,
  opts: OrchestrationOptions = {},
): Promise<RunResult> {
  const runId = opts.runId ?? createAuditRunId("run");
  const audit = opts.audit;
  const textMode: AgentRunMode = opts.textMode ?? "fixture";
  const imageMode = opts.imageMode ?? "dry-run";
  const listingMode = textMode === "live" ? "live" : "fixture";

  const ctx: AgentContext = {
    brief,
    results: {},
    providers: opts.providers ?? createSeedProviders(),
    risk: createRiskSupervisor(),
  };

  // Execution order: risk runs LAST to aggregate margin/listing/packaging/committee checkpoints.
  const agents: Agent[] = [
    (c) =>
      runMarketAgent({ brief: c.brief }, c, { mode: textMode, runId, audit }).then(
        toMarketRunResultSlice,
      ),
    (c) => {
      const primary = c.results.opportunities?.find((o) => o.is_primary);
      const direction = primaryOpportunityToDirection(primary, c);
      return runSourcingAgent({ brief: c.brief, primary_direction: direction }, c, {
        mode: textMode,
        runId,
        audit,
      }).then((output) => toSourcingRunResultSlice(output, primary));
    },
    marginAgent,
    (c) => runListingAgent(c, { mode: listingMode, runId, audit }),
    (c) => runPackagingAgent(c, { imageMode, runId }),
    committeeAgent,
    riskAgent,
  ];

  const { results } = await runPipeline(agents, ctx);

  const runResult: RunResult = {
    run_id: runId,
    audit_run_id: runId,
    created_at: opts.createdAt ?? new Date().toISOString(),
    currency: opts.currency ?? "SGD",
    brief,
    agents: orderAgents(results.agents ?? []),
    opportunities: results.opportunities ?? [],
    committee: results.committee as Committee,
    selected_listing: results.selected_listing as SelectedListing,
  };

  // 铁律 1 / #15 验收:返回前必过 check-contract。
  assertValidRunResult(runResult);
  return runResult;
}
