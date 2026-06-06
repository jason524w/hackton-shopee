import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveAuditRoot } from "../audit-root";

describe("resolveAuditRoot", () => {
  it("honors an explicit SEA_AUDIT_DIR override (resolved to absolute)", () => {
    expect(resolveAuditRoot({ SEA_AUDIT_DIR: "/custom/audit" })).toBe("/custom/audit");
  });

  it("uses a writable tmp dir on serverless platforms (read-only project dir)", () => {
    const expected = join(tmpdir(), "sea-launch-runs");
    expect(resolveAuditRoot({ VERCEL: "1" })).toBe(expected);
    expect(resolveAuditRoot({ AWS_LAMBDA_FUNCTION_NAME: "fn" })).toBe(expected);
  });

  it("defaults to an absolute .runs under cwd for local dev", () => {
    const root = resolveAuditRoot({});
    expect(isAbsolute(root)).toBe(true);
    expect(root.endsWith("/.runs")).toBe(true);
  });

  it("prefers the explicit override even on serverless", () => {
    expect(resolveAuditRoot({ VERCEL: "1", SEA_AUDIT_DIR: "/custom/audit" })).toBe("/custom/audit");
  });
});
