import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { NextResponse } from "next/server";

import type { AgentAuditSnapshot } from "../../../../../lib/agent-runtime/audit";
import { AUDIT_ROOT_DIR } from "../../../../../lib/agents/orchestrate";
import { CANONICAL_AGENT_ORDER } from "../../../../../lib/agents/validate-run-result";

export const runtime = "nodejs";

// GET /api/runs/:id/audit — returns the per-agent audit snapshots persisted by the
// FileAuditSink during the run (tool calls, model responses, schema results, timing).
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const runId = params.id;
  const agentsDir = join(process.cwd(), AUDIT_ROOT_DIR, runId, "agents");

  let files: string[];
  try {
    files = await readdir(agentsDir);
  } catch {
    return NextResponse.json(
      { status: "not_found", audit_run_id: runId, message: "No audit record for this run id" },
      { status: 404 },
    );
  }

  const snapshots: AgentAuditSnapshot[] = [];
  for (const file of files) {
    if (!file.endsWith(".json")) continue;
    try {
      const raw = await readFile(join(agentsDir, file), "utf8");
      snapshots.push(JSON.parse(raw) as AgentAuditSnapshot);
    } catch {
      // Skip unreadable/partial snapshots rather than failing the whole audit read.
    }
  }

  const order = new Map(CANONICAL_AGENT_ORDER.map((key, i) => [key, i]));
  snapshots.sort(
    (a, b) => (order.get(a.agent_key) ?? 99) - (order.get(b.agent_key) ?? 99),
  );

  return NextResponse.json({ audit_run_id: runId, agents: snapshots }, { status: 200 });
}
