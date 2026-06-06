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
  fixture?: CommitteeOutput; // override the fixture output (testing / #15 injection)
}

/**
 * The LLM may set the verdict freely (pure-A), but its output must still STRUCTURALLY
 * cover every opportunity exactly once — decisions and ranked_ids cover the same id set.
 * This is not a verdict guardrail (we don't override Go/Watch/Reject); it only rejects
 * a malformed/incomplete response so we don't silently keep stale decisions.
 */
export function isComplete(output: CommitteeOutput, opps: Opportunity[]): boolean {
  const ids = new Set(opps.map((o) => o.id));
  const coversExactly = (arr: string[]): boolean =>
    arr.length === ids.size && new Set(arr).size === ids.size && arr.every((id) => ids.has(id));
  return coversExactly(output.decisions.map((d) => d.id)) && coversExactly(output.ranked_ids);
}

/** Runs the LLM committee (or fixture). On failure OR incomplete output, returns the deterministic fallback flagged degraded. */
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
    fixture: options.fixture ?? (() => deterministicOutput(opps, ctx)),
    retryOnce: true,
  });

  if (result.ok && isComplete(result.output, opps)) {
    return { output: result.output, degraded: null };
  }

  // Live LLM failed OR returned an incomplete decision set → deterministic fallback.
  const degraded: DiagnosticError = result.ok
    ? {
        code: "SCHEMA_VALIDATION_FAILED",
        message: "committee output did not cover all opportunities exactly once",
        retryable: false,
      }
    : result.error;
  return { output: deterministicOutput(opps, ctx), degraded };
}

/**
 * Build a pipeline Agent bound to a run mode. #15 should wire `committeeLiveAgent`
 * (or `makeCommitteeAgent("live")`) directly into runPipeline so the LLM actually
 * runs — the Agent seam has no mode param, so the default `committeeAgent` is fixture.
 */
export function makeCommitteeAgent(mode: AgentRunMode): Agent {
  return async (ctx: AgentContext): Promise<Partial<RunResult>> => {
    const { output, degraded } = await runCommitteeAgent(ctx, { mode });
    return toCommitteeSlice(output, ctx.results.opportunities ?? [], degraded);
  };
}

/** Default = fixture (dry-run / tests). */
export const committeeAgent: Agent = makeCommitteeAgent("fixture");

/** Live LLM verdict — #15 drops this into runPipeline. */
export const committeeLiveAgent: Agent = makeCommitteeAgent("live");

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
    audit_summary: "",
    score: top ? computeOverall(top.scores) : 0,
    confidence: degraded ? 0.5 : 0.75,
    warnings: degraded ? [`⚠ LLM 委员会降级:确定性兜底(${degraded.code})`] : [],
  };

  return { opportunities, committee, agents: [agent] };
}
