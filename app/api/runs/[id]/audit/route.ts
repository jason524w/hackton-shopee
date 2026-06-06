import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { NextResponse } from "next/server";

import type { AgentAuditSnapshot } from "../../../../../lib/agent-runtime/audit";
import { resolveAuditRoot } from "../../../../../lib/agents/audit-root";
import { CANONICAL_AGENT_ORDER } from "../../../../../lib/agents/validate-run-result";
import { isSafeAuditRunId } from "./run-id";

export const runtime = "nodejs";

// GET /api/runs/:id/audit
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const runId = params.id;
  const auditRoot = resolveAuditRoot();
  const agentsDir = resolve(auditRoot, runId, "agents");

  if (!isSafeAuditRunId(runId) || !agentsDir.startsWith(join(auditRoot, runId) + "/")) {
    return NextResponse.json(
      { status: "not_found", audit_run_id: runId, message: "No audit record for this run id" },
      { status: 404 },
    );
  }

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
    if (!file.endsWith(".json")) {
      continue;
    }
    try {
      const raw = await readFile(join(agentsDir, file), "utf8");
      snapshots.push(JSON.parse(raw) as AgentAuditSnapshot);
    } catch {
      // Ignore partial or unreadable audit files.
    }
  }

  const order = new Map(CANONICAL_AGENT_ORDER.map((key, index) => [key, index]));
  snapshots.sort((left, right) => (order.get(left.agent_key) ?? 99) - (order.get(right.agent_key) ?? 99));

  return NextResponse.json({ audit_run_id: runId, agents: snapshots }, { status: 200 });
}
