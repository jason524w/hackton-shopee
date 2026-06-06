import type { AgentKey, Brief, Committee, RunResult, SelectedListing } from "../../contract/result";
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
import { createOpenAIImageProvider } from "../providers/openai-image";
import { makeCommitteeAgent } from "./committee";
import { type Agent, type AgentContext, type AgentProviders, runPipeline } from "./contracts";
import { runListingAgent } from "./listing";
import { marginAgent } from "./margin";
import { runMarketAgent, toMarketRunResultSlice } from "./market";
import { runPackagingAgent } from "./packaging";
import { createRiskSupervisor, riskAgent } from "./risk";
import { primaryOpportunityToDirection, runSourcingAgent, toSourcingRunResultSlice } from "./sourcing";
import { assertValidRunResult, CANONICAL_AGENT_ORDER } from "./validate-run-result";

export const AUDIT_ROOT_DIR = ".runs";

export interface OrchestrationOptions {
  textMode?: AgentRunMode;
  imageMode?: "live" | "dry-run";
  audit?: AuditSink;
  runId?: string;
  currency?: string;
  createdAt?: string;
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

export function createOrchestrationProviders(imageMode: "live" | "dry-run" = "dry-run"): AgentProviders {
  return {
    ...createSeedProviders(),
    openaiImage: createOpenAIImageProvider({ mode: imageMode }),
  };
}

function withAuditEnvelope(
  key: AgentKey,
  agent: Agent,
  runId: string,
  audit: AuditSink,
  mode: AgentRunMode,
): Agent {
  return async (ctx) => {
    const slice = await agent(ctx);
    const existing = await audit.getAgentSnapshot(runId, key);
    if (!existing) {
      await audit.startAgent({
        runId,
        agentKey: key,
        skillVersion: "pipeline-envelope",
        mode,
        input: {},
        metadata: { source: "orchestrate-envelope" },
      });
      await audit.completeAgent(runId, key, slice);
    }
    return slice;
  };
}

function orderAgents(agents: RunResult["agents"]): RunResult["agents"] {
  const byKey = new Map(agents.map((agent) => [agent.key, agent]));
  return CANONICAL_AGENT_ORDER.map((key) => byKey.get(key)).filter(
    (agent): agent is RunResult["agents"][number] => Boolean(agent),
  );
}

export async function runOrchestration(brief: Brief, opts: OrchestrationOptions = {}): Promise<RunResult> {
  const runId = opts.runId ?? createAuditRunId("run");
  const textMode: AgentRunMode = opts.textMode ?? "fixture";
  const imageMode = opts.imageMode ?? "dry-run";
  const listingMode = textMode === "live" ? "live" : "fixture";

  const ctx: AgentContext = {
    brief,
    results: {},
    providers: opts.providers ?? createOrchestrationProviders(imageMode),
    risk: createRiskSupervisor(),
  };

  const keyedAgents: Array<[AgentKey, Agent]> = [
    [
      "market",
      (agentCtx) =>
        runMarketAgent({ brief: agentCtx.brief }, agentCtx, {
          mode: textMode,
          runId,
          audit: opts.audit,
        }).then(toMarketRunResultSlice),
    ],
    [
      "sourcing",
      (agentCtx) => {
        const primary = agentCtx.results.opportunities?.find((opportunity) => opportunity.is_primary);
        const direction = primaryOpportunityToDirection(primary, agentCtx);
        return runSourcingAgent({ brief: agentCtx.brief, primary_direction: direction }, agentCtx, {
          mode: textMode,
          runId,
          audit: opts.audit,
        }).then((output) => toSourcingRunResultSlice(output, primary));
      },
    ],
    ["margin", marginAgent],
    ["listing", (agentCtx) => runListingAgent(agentCtx, { mode: listingMode, runId, audit: opts.audit })],
    ["packaging", (agentCtx) => runPackagingAgent(agentCtx, { imageMode, runId })],
    ["committee", makeCommitteeAgent(textMode)],
    ["risk", riskAgent],
  ];

  const agents = keyedAgents.map(([key, agent]) =>
    opts.audit ? withAuditEnvelope(key, agent, runId, opts.audit, textMode) : agent,
  );

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

  assertValidRunResult(runResult);
  return runResult;
}
