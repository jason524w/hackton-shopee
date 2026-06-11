import { afterEach, describe, expect, it, vi } from "vitest";
import { __resetBootGuardForTests, resumeRunsOnBoot, type BootResumeDeps } from "../boot";

function deps(overrides: Partial<BootResumeDeps> = {}): BootResumeDeps {
  return {
    hasKey: () => true,
    resume: async () => 0,
    log: () => {},
    warn: () => {},
    ...overrides,
  };
}

describe("resumeRunsOnBoot", () => {
  afterEach(() => __resetBootGuardForTests());

  it("resumes incomplete runs when a key is configured", async () => {
    const resume = vi.fn(async () => 3);
    const count = await resumeRunsOnBoot(deps({ resume }));
    expect(resume).toHaveBeenCalledOnce();
    expect(count).toBe(3);
  });

  it("only resumes once per process (idempotent guard)", async () => {
    const resume = vi.fn(async () => 2);
    await resumeRunsOnBoot(deps({ resume }));
    const second = await resumeRunsOnBoot(deps({ resume }));
    expect(resume).toHaveBeenCalledOnce();
    expect(second).toBe(0);
  });

  it("skips (without consuming the guard) when no key is set", async () => {
    const resume = vi.fn(async () => 5);
    const first = await resumeRunsOnBoot(deps({ hasKey: () => false, resume }));
    expect(resume).not.toHaveBeenCalled();
    expect(first).toBe(0);

    // A later boot with the key now set should still resume (guard wasn't consumed).
    const second = await resumeRunsOnBoot(deps({ hasKey: () => true, resume }));
    expect(resume).toHaveBeenCalledOnce();
    expect(second).toBe(5);
  });

  it("does not throw and allows retry if resume fails", async () => {
    const failing = vi.fn(async () => {
      throw new Error("store unavailable");
    });
    const warn = vi.fn();
    const first = await resumeRunsOnBoot(deps({ resume: failing, warn }));
    expect(first).toBe(0);
    expect(warn).toHaveBeenCalled();

    // Guard was released on failure → a subsequent trigger retries.
    const ok = vi.fn(async () => 1);
    const second = await resumeRunsOnBoot(deps({ resume: ok }));
    expect(ok).toHaveBeenCalledOnce();
    expect(second).toBe(1);
  });
});
