import { describe, expect, it } from "vitest";

import { createAuditRunId } from "../../agent-runtime/audit";
import { isSafeAuditRunId } from "../../../app/api/runs/[id]/audit/run-id";

describe("isSafeAuditRunId", () => {
  it("accepts ids produced by createAuditRunId", () => {
    expect(isSafeAuditRunId(createAuditRunId("run"))).toBe(true);
    expect(isSafeAuditRunId("run_5d27993e-0678-4cdd-8fef-d621a930217b")).toBe(true);
  });

  it("rejects path-traversal and separator characters", () => {
    expect(isSafeAuditRunId("../../etc/passwd")).toBe(false);
    expect(isSafeAuditRunId("run_../../secret")).toBe(false);
    expect(isSafeAuditRunId("run_a/b")).toBe(false);
    expect(isSafeAuditRunId("/etc/passwd")).toBe(false);
    expect(isSafeAuditRunId("run_a\\b")).toBe(false);
  });

  it("rejects empty / wrong-prefix ids", () => {
    expect(isSafeAuditRunId("")).toBe(false);
    expect(isSafeAuditRunId("run_")).toBe(false);
    expect(isSafeAuditRunId("notrun_abc")).toBe(false);
  });
});
