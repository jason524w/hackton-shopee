import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createEasyshipShippingProvider } from "../index";

loadEnvLocal();

const live = process.env.LIVE_EASYSHIP_TESTS === "1";

describe.skipIf(!live)("Easyship live shipping provider", () => {
  it("returns at least one live CN to SG rate for the mini desk vacuum package", async () => {
    const provider = createEasyshipShippingProvider();
    const result = await provider.estimateCrossBorder({
      weight_g: 150,
      dimensions_cm: { length: 2, width: 2, height: 2 },
      from: "CN",
      to: "SG",
    });

    expect(result.source.provider).toBe("easyship");
    expect(result.source.mode).toBe("live");
    expect(result.source.raw_snapshot_id).toBeTruthy();
    expect(result.scenarios.base.cost_sgd).toBeGreaterThan(0);
    expect(result.scenarios.base.days_max).toBeGreaterThanOrEqual(result.scenarios.base.days_min);
  }, 60_000);
});

function loadEnvLocal(): void {
  const envPath = join(process.cwd(), ".env.local");
  try {
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      if (separator === -1) {
        continue;
      }
      const key = trimmed.slice(0, separator).trim();
      const value = trimmed.slice(separator + 1).trim();
      if (key && process.env[key] === undefined) {
        process.env[key] = value;
      }
    }
  } catch {
    // Missing .env.local is reported by the provider as a diagnostic error.
  }
}
