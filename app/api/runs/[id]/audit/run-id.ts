// Guards the untrusted :id route param before it is joined into a filesystem path
// (.runs/<id>/agents). Restricts to the createAuditRunId shape (`run_<uuid>` or the
// `run_<ts>-<hex>` fallback) so "../"-style traversal and path separators can never
// reach readdir/readFile. See app/api/runs/[id]/audit/route.ts.
const AUDIT_RUN_ID = /^run_[A-Za-z0-9-]+$/;

export function isSafeAuditRunId(id: string): boolean {
  return AUDIT_RUN_ID.test(id);
}
