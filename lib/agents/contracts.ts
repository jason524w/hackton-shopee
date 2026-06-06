import type {
  AgentResult,
  Brief,
  Evidence,
  Opportunity,
  RiskLevel,
  RunResult,
} from "../../contract/result";
import type {
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
    pipelineContext.results = mergeRunResultSlice(pipelineContext.results, slice);
  }

  return {
    results: pipelineContext.results,
    risk_checkpoints: ctx.risk.getCheckpoints(),
  };
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
