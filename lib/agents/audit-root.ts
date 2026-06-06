import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

// Resolves the directory the FileAuditSink writes to (and GET /api/runs/:id/audit
// reads from). On Vercel/Lambda the project directory is read-only — writing .runs
// there throws and 500s every non-mock run — so fall back to a writable tmp dir.
// SEA_AUDIT_DIR overrides everything (e.g. a mounted volume); local dev uses .runs.
export function resolveAuditRoot(env: Record<string, string | undefined> = process.env): string {
  if (env.SEA_AUDIT_DIR) return resolve(env.SEA_AUDIT_DIR);
  if (env.VERCEL || env.AWS_LAMBDA_FUNCTION_NAME || env.NETLIFY) {
    return join(tmpdir(), "sea-launch-runs");
  }
  return resolve(process.cwd(), ".runs");
}
