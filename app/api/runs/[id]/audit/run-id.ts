const AUDIT_RUN_ID = /^run_[A-Za-z0-9-]+$/;

export function isSafeAuditRunId(id: string): boolean {
  return AUDIT_RUN_ID.test(id);
}
