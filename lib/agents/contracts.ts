import type {
  AgentResult,
  Brief,
  Evidence,
  Opportunity,
  RiskLevel,
  RunResult,
} from "../../contract/result";
import type {
  BrowserRetrievalProvider,
  FxProvider,
  OpenAIImageProvider,
  ShippingProvider,
  ShopeeProvider,
  Sourcing1688Provider,
} from "../providers";

export interface AgentProviders {
  shopee: ShopeeProvider;
  sourcing1688: Sourcing1688Provider;
  shipping: ShippingProvider;
  fx: FxProvider;
  openaiImage: OpenAIImageProvider;
  browser: BrowserRetrievalProvider;
}

// Risk supervises the downstream business decision checkpoints. Market and
// sourcing provide evidence, while the risk agent itself aggregates these stages.
export type RiskCheckpointStage = "margin" | "listing" | "packaging" | "committee";

export interface RiskCheckpoint {
  stage: RiskCheckpointStage;
  risk_level: RiskLevel;
  human_review_required: boolean;
  hard_block: boolean;
  warnings: string[];
  evidence: Evidence[];
  flags: string[];
}

export interface RiskSupervisor {
  checkpoint(stage: RiskCheckpointStage, payload: unknown): Promise<RiskCheckpoint>;
  getCheckpoints(): RiskCheckpoint[];
}

export interface AgentContext {
  brief: Brief;
  results: Partial<RunResult>;
  providers: AgentProviders;
  risk: RiskSupervisor;
}

export type Agent = (ctx: AgentContext) => Promise<Partial<RunResult>>;

export interface RunPipelineResult {
  results: Partial<RunResult>;
  risk_checkpoints: RiskCheckpoint[];
}

export function createNoopRisk(): RiskSupervisor {
  const checkpoints: RiskCheckpoint[] = [];

  return {
    async checkpoint(stage: RiskCheckpointStage): Promise<RiskCheckpoint> {
      const checkpoint = createNoopRiskCheckpoint(stage);
      checkpoints.push(checkpoint);
      return cloneRiskCheckpoint(checkpoint);
    },

    getCheckpoints(): RiskCheckpoint[] {
      return checkpoints.map(cloneRiskCheckpoint);
    },
  };
}

// Stateless singleton for callers that need an inert supervisor and do not care
// about captured checkpoint history. Harnesses should use createNoopRisk().
export const noopRisk: RiskSupervisor = {
  async checkpoint(stage: RiskCheckpointStage): Promise<RiskCheckpoint> {
    return createNoopRiskCheckpoint(stage);
  },

  getCheckpoints(): RiskCheckpoint[] {
    return [];
  },
};

export async function runPipeline(agents: Agent[], ctx: AgentContext): Promise<RunPipelineResult> {
  const pipelineContext: AgentContext = {
    ...ctx,
    results: { ...ctx.results },
  };

  for (const agent of agents) {
    const slice = await agent(pipelineContext);
    pipelineContext.results = mergeRunResultSlice(pipelineContext.results, withAgentAuditSummaries(slice));
  }

  return {
    results: pipelineContext.results,
    risk_checkpoints: ctx.risk.getCheckpoints(),
  };
}

export function withAgentAuditSummaries(slice: Partial<RunResult>): Partial<RunResult> {
  if (!slice.agents?.length) {
    return slice;
  }

  return {
    ...slice,
    agents: slice.agents.map((agent) => ({ ...agent, audit_summary: buildAgentAuditSummary(agent) })),
  };
}

export function buildAgentAuditSummary(agent: AgentResult): string {
  const tools = summarizeList(agent.data_sources, "no external tool/source declared");
  const evidence = summarizeList(
    agent.evidence.slice(0, 2).map((item) => `${item.label}: ${item.value}`),
    "no structured evidence declared",
  );
  const warnings = summarizeList(agent.warnings, "none");
  const confidence = Math.round(agent.confidence * 100);

  return [
    `Tools: ${tools}`,
    `Found: ${clip(agent.key_judgment)}; evidence: ${evidence}`,
    `Action: ${agent.name} processed ${clip(agent.inputs_summary)}`,
    `Output: ${agent.status}, score ${agent.score}/100, confidence ${confidence}%, warnings: ${warnings}`,
  ].join(". ");
}

export function mergeRunResultSlice(
  current: Partial<RunResult>,
  slice: Partial<RunResult>,
): Partial<RunResult> {
  return {
    ...current,
    ...slice,
    agents: mergeAgents(current.agents, slice.agents),
    opportunities: mergeOpportunities(current.opportunities, slice.opportunities),
  };
}

function mergeAgents(current: AgentResult[] | undefined, next: AgentResult[] | undefined): AgentResult[] | undefined {
  if (!current && !next) {
    return undefined;
  }

  return mergeByKey(current ?? [], next ?? [], (agent) => agent.key);
}

function mergeOpportunities(
  current: Opportunity[] | undefined,
  next: Opportunity[] | undefined,
): Opportunity[] | undefined {
  if (!current && !next) {
    return undefined;
  }

  return mergeByKey(current ?? [], next ?? [], (opportunity) => opportunity.id);
}

function mergeByKey<Item>(
  current: Item[],
  next: Item[],
  getKey: (item: Item) => string,
): Item[] {
  const merged = new Map<string, Item>();

  for (const item of current) {
    merged.set(getKey(item), item);
  }

  for (const item of next) {
    merged.set(getKey(item), item);
  }

  return Array.from(merged.values());
}

function summarizeList(values: string[], fallback: string): string {
  const cleaned = values.map((value) => clip(value)).filter(Boolean);
  return cleaned.length ? cleaned.slice(0, 3).join("; ") : fallback;
}

function clip(value: string, maxLength = 160): string {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}...` : normalized;
}

function createNoopRiskCheckpoint(stage: RiskCheckpointStage): RiskCheckpoint {
  return {
    stage,
    risk_level: "low",
    human_review_required: false,
    hard_block: false,
    warnings: [],
    evidence: [],
    flags: [],
  };
}

function cloneRiskCheckpoint(checkpoint: RiskCheckpoint): RiskCheckpoint {
  return {
    ...checkpoint,
    warnings: [...checkpoint.warnings],
    evidence: checkpoint.evidence.map((item) => ({ ...item })),
    flags: [...checkpoint.flags],
  };
}
