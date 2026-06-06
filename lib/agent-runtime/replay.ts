import { readFile } from "node:fs/promises";
import type { AgentAuditSnapshot } from "./audit";
import { InMemoryAuditSink } from "./audit";
import { AgentRuntimeError, type RuntimeAgentKey } from "./errors";
import type { JsonSchema } from "./schemas";
import { validateJsonSchema } from "./schemas";
import type { AgentTool } from "./tool-runner";
import type { AgentSkill, RunAgentOptions, RunAgentResult } from "./run-agent";
import { runAgent } from "./run-agent";

export interface ReplaySnapshotResult<Output> {
  ok: true;
  run_id: string;
  agent_key: RuntimeAgentKey;
  output: Output;
}

export interface ReplaySnapshotFailure {
  ok: false;
  run_id: string;
  agent_key: RuntimeAgentKey;
  error: ReturnType<AgentRuntimeError["toDiagnostic"]>;
}

export async function loadAgentAuditSnapshot(path: string): Promise<AgentAuditSnapshot> {
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as AgentAuditSnapshot;
}

export function replayOutputFromSnapshot<Output>(
  snapshot: AgentAuditSnapshot,
  outputSchema: JsonSchema,
): ReplaySnapshotResult<Output> | ReplaySnapshotFailure {
  if (snapshot.output_snapshot === undefined) {
    const error = new AgentRuntimeError("REPLAY_NOT_FOUND", "Audit snapshot has no output to replay", {
      runId: snapshot.run_id,
      agentKey: snapshot.agent_key,
      retryable: false,
    });
    return {
      ok: false,
      run_id: snapshot.run_id,
      agent_key: snapshot.agent_key,
      error: error.toDiagnostic(),
    };
  }

  const validation = validateJsonSchema(outputSchema, snapshot.output_snapshot);
  if (!validation.valid) {
    const error = new AgentRuntimeError("SCHEMA_VALIDATION_FAILED", "Replayed output failed schema validation", {
      runId: snapshot.run_id,
      agentKey: snapshot.agent_key,
      details: { errors: validation.errors },
      retryable: false,
    });
    return {
      ok: false,
      run_id: snapshot.run_id,
      agent_key: snapshot.agent_key,
      error: error.toDiagnostic(),
    };
  }

  return {
    ok: true,
    run_id: snapshot.run_id,
    agent_key: snapshot.agent_key,
    output: snapshot.output_snapshot as Output,
  };
}

export function createReplayTools(snapshot: AgentAuditSnapshot, options: { matchInputs?: boolean } = {}): AgentTool[] {
  const queues = new Map<string, typeof snapshot.tool_calls>();
  for (const call of snapshot.tool_calls.filter((record) => record.status === "completed")) {
    const queue = queues.get(call.tool_name) ?? [];
    queue.push(call);
    queues.set(call.tool_name, queue);
  }

  return Array.from(queues.keys()).map((toolName) => ({
    name: toolName,
    description: `Replay tool for ${toolName} from audit snapshot ${snapshot.run_id}.`,
    parameters: { type: "object", additionalProperties: true },
    async execute(input: unknown) {
      const queue = queues.get(toolName) ?? [];
      const next = queue.shift();
      if (!next) {
        throw new AgentRuntimeError("REPLAY_NOT_FOUND", `No replayed tool output remains for ${toolName}`, {
          runId: snapshot.run_id,
          agentKey: snapshot.agent_key,
          retryable: false,
        });
      }

      if (options.matchInputs && JSON.stringify(input) !== JSON.stringify(next.input)) {
        throw new AgentRuntimeError("TOOL_INPUT_INVALID", `Replay input mismatch for ${toolName}`, {
          runId: snapshot.run_id,
          agentKey: snapshot.agent_key,
          details: { expected: next.input, received: input },
          retryable: false,
        });
      }

      return next.output;
    },
  }));
}

export async function replayAgentFixture<Input, Output>(input: {
  snapshot: AgentAuditSnapshot;
  outputSchema: JsonSchema;
  skill?: AgentSkill;
}): Promise<RunAgentResult<Output>> {
  const fixture = replayOutputFromSnapshot<Output>(input.snapshot, input.outputSchema);
  if (!fixture.ok) {
    return {
      ok: false,
      run_id: input.snapshot.run_id,
      agent_key: input.snapshot.agent_key,
      error: fixture.error,
      attempts: 1,
      latency_ms: 0,
    };
  }

  const options: RunAgentOptions<Input, Output> = {
    agentKey: input.snapshot.agent_key,
    skill:
      input.skill ??
      {
        name: `${input.snapshot.agent_key} replay`,
        role: "Replay previously captured audit output.",
        instructions: "Return the captured fixture output.",
        version: input.snapshot.skill_version ?? "replay",
      },
    input: input.snapshot.input_snapshot as Input,
    outputSchema: input.outputSchema,
    mode: "fixture",
    fixture: fixture.output,
    runId: input.snapshot.run_id,
    audit: new InMemoryAuditSink(),
  };

  return runAgent(options);
}
