import { join } from "node:path";
import type { AgentKey, Brief, Committee, RunResult, SelectedListing } from "../../contract/result";
import { createAuditRunId, type AuditSink } from "../agent-runtime/audit";
import type { AgentRunMode } from "../agent-runtime/run-agent";
import {
  createChromeBrowserRetrievalProvider,
  createFxProviderFromEnv,
  createSeedBrowserRetrievalProvider,
  createSeedFxProvider,
  createSeedOpenAIImageProvider,
  createSeedShippingProvider,
  createSeedShopeeProvider,
  createSeedSourcing1688Provider,
  createShippingProviderFromEnv,
} from "../providers";
import { createCdpChromeBrowserController } from "../providers/browser-retrieval";
import { createOpenAIImageProvider } from "../providers/openai-image";
import { FilesystemScrapeCache } from "../scrape/cache";
import { createCachedBrowserController } from "../scrape/cached-controller";
import { createManagedControllerFromEnv } from "../scrape/from-env";
import { resolveAuditRoot } from "./audit-root";
import { makeCommitteeAgent } from "./committee";
import { type Agent, type AgentContext, type AgentProviders, runPipeline } from "./contracts";
import { runListingAgent } from "./listing";
import { marginAgent } from "./margin";
import { runMarketAgent, toMarketRunResultSlice } from "./market";
import { runPackagingAgent } from "./packaging";
import { createRiskSupervisor, riskAgent } from "./risk";
import { primaryOpportunityToDirection, runSourcingAgent, toSourcingRunResultSlice } from "./sourcing";
import { assertValidRunResult, CANONICAL_AGENT_ORDER } from "./validate-run-result";

export { resolveAuditRoot };

export interface OrchestrationOptions {
  textMode?: AgentRunMode;
  imageMode?: "live" | "dry-run";
  audit?: AuditSink;
  runId?: string;
  currency?: string;
  createdAt?: string;
  providers?: AgentProviders;
  /**
   * Fired just before each agent runs, with its canonical key. Lets the async runner
   * persist run progress (current_agent) without coupling orchestration to the RunStore.
   * Errors thrown by the callback are swallowed so progress reporting can't fail a run.
   */
  onAgentStart?: (agentKey: AgentKey) => void;
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

/**
 * Provider selection is env-driven but SEED-DEFAULT so the demo is unchanged unless
 * explicitly opted in (CLAUDE.md demo-safe constraint):
 * - shipping honors LOGISTICS_PROVIDER but defaults to the seed provider.
 * - browser retrieval uses the live Chrome pipeline ONLY when BROWSER_RETRIEVAL_MODE=live;
 *   otherwise it stays seed-backed (no live scraping by default). In live mode the Chrome
 *   controller is wrapped in a scrape cache (unless SCRAPE_CACHE=off) so repeated/identical
 *   captures across a run are reused — cutting cost, latency, and anti-bot exposure.
 * - openaiImage stays live via imageMode (already gated upstream).
 */
function createBrowserProviderFromEnv() {
  if (process.env.BROWSER_RETRIEVAL_MODE === "live") {
    // Engine: default CDP controller, or the managed Playwright stack (proxy pool / rate
    // limiter / circuit breaker / session / handoff) when SCRAPE_ENGINE=playwright (A2).
    let controller =
      process.env.SCRAPE_ENGINE === "playwright"
        ? createManagedControllerFromEnv()
        : createCdpChromeBrowserController();
    if (process.env.SCRAPE_CACHE !== "off") {
      const cache = new FilesystemScrapeCache(join(resolveAuditRoot(), "scrape-cache"));
      controller = createCachedBrowserController(controller, cache);
    }
    return createChromeBrowserRetrievalProvider(controller);
  }
  return createSeedBrowserRetrievalProvider();
}

export function createOrchestrationProviders(imageMode: "live" | "dry-run" = "dry-run"): AgentProviders {
  return {
    ...createSeedProviders(),
    fx: createFxProviderFromEnv(),
    shipping: createShippingProviderFromEnv(),
    browser: createBrowserProviderFromEnv(),
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
  // Live is the only production mode; "fixture" may only be passed from test code.
  const textMode: AgentRunMode = opts.textMode ?? "live";
  const imageMode = opts.imageMode ?? "dry-run";
  const listingMode = textMode === "live" ? "live" : "fixture";

  // Fixture mode is for deterministic, offline testing — it must NEVER touch live
  // providers (FX/shipping/scrape network calls). Live mode uses the env-routed
  // (default-live) providers.
  const defaultProviders =
    textMode === "fixture" ? createSeedProviders() : createOrchestrationProviders(imageMode);
  const ctx: AgentContext = {
    brief,
    results: {},
    providers: opts.providers ?? defaultProviders,
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

  const agents = keyedAgents.map(([key, agent]) => {
    const audited = opts.audit ? withAuditEnvelope(key, agent, runId, opts.audit, textMode) : agent;
    if (!opts.onAgentStart) {
      return audited;
    }
    // Report progress before the agent runs; never let a progress-callback error fail the run.
    return (agentCtx: AgentContext) => {
      try {
        opts.onAgentStart?.(key);
      } catch {
        // ignore progress reporting failures
      }
      return audited(agentCtx);
    };
  });

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
