// Committee Agent — pure-A: the LLM decides the verdict; deterministic gates are
// the fixture (dry-run) output and the live-failure fallback. See docs/design/committee.md.

import type { AgentResult, Committee, Opportunity, RunResult } from "../../../contract/result";
import type { DiagnosticError } from "../../agent-runtime/errors";
import { runAgent, type AgentRunMode } from "../../agent-runtime/run-agent";
import type { Agent, AgentContext } from "../contracts";
import { buildEvidence, deterministicOutput } from "./evidence";
import { COMMITTEE_OUTPUT_SCHEMA, type CommitteeAgentInput, type CommitteeOutput } from "./schema";
import { committeeSkill } from "./skill";
import { COMMITTEE_WEIGHTS, computeOverall } from "./weights";

export { COMMITTEE_WEIGHTS, computeOverall } from "./weights";
export { buildEvidence, deterministicOutput } from "./evidence";

export interface RunCommitteeOptions {
  mode?: AgentRunMode;
}

/** Runs the LLM committee (or fixture). On live failure, returns the deterministic fallback flagged degraded. */
export async function runCommitteeAgent(
  ctx: AgentContext,
  options: RunCommitteeOptions = {},
): Promise<{ output: CommitteeOutput; degraded: DiagnosticError | null }> {
  const mode = options.mode ?? "fixture";
  const opps = ctx.results.opportunities ?? [];
  const input = buildEvidence(opps, ctx);

  const result = await runAgent<CommitteeAgentInput, CommitteeOutput>({
    agentKey: "committee",
    skill: committeeSkill,
    input,
    outputSchema: COMMITTEE_OUTPUT_SCHEMA,
    tools: [],
    mode,
    fixture: () => deterministicOutput(opps, ctx),
    retryOnce: true,
  });

  if (result.ok) return { output: result.output, degraded: null };
  // Live LLM failed → deterministic fallback (surfaced as degraded).
  return { output: deterministicOutput(opps, ctx), degraded: result.error };
}

export const committeeAgent: Agent = async (ctx: AgentContext): Promise<Partial<RunResult>> => {
  const { output, degraded } = await runCommitteeAgent(ctx);
  return toCommitteeSlice(output, ctx.results.opportunities ?? [], degraded);
};

export function toCommitteeSlice(
  output: CommitteeOutput,
  opps: Opportunity[],
  degraded: DiagnosticError | null,
): Partial<RunResult> {
  const byId = new Map(output.decisions.map((d) => [d.id, d]));
  const opportunities: Opportunity[] = opps.map((o) => {
    const d = byId.get(o.id);
    if (!d) return o;
    return {
      ...o,
      decision: d.verdict,
      decision_reason: d.decision_reason,
      key_reasons: d.key_reasons,
      scores: { ...o.scores, overall: computeOverall(o.scores) },
    };
  });

  const committee: Committee = {
    ranked_ids: output.ranked_ids,
    weights: { ...COMMITTEE_WEIGHTS },
    tradeoffs: output.tradeoffs,
    summary: degraded ? `(LLM 暂不可用,以下为确定性兜底决策)${output.summary}` : output.summary,
  };

  const top = opportunities.find((o) => o.id === output.ranked_ids[0]);
  const agent: AgentResult = {
    key: "committee",
    name: "Committee",
    role: "投委会:合并打分 + 决策 + 反证",
    status: "done",
    inputs_summary: `${opps.length} 候选 · 加权 + 决策`,
    data_sources: ["committee deterministic + LLM"],
    evidence: output.decisions.map((d) => ({ label: d.id, value: d.verdict })),
    key_judgment: output.summary,
    score: top ? computeOverall(top.scores) : 0,
    confidence: degraded ? 0.5 : 0.75,
    warnings: degraded ? [`⚠ LLM 委员会降级:确定性兜底(${degraded.code})`] : [],
  };

  return { opportunities, committee, agents: [agent] };
}
