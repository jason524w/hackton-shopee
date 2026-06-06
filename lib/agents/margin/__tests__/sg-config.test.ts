import { describe, expect, it } from "vitest";
import config from "../../../../seed/margin/shopee-sg-2026-06-06.json";

describe("Shopee SG margin config seed", () => {
  it("keeps source-backed market metadata for margin assumptions", () => {
    expect(config.as_of).toBe("2026-06-06");
    expect(config.market).toBe("SG");
    expect(config.platform).toBe("shopee_sg");
    expect(config.currency).toBe("SGD");
    expect(config.sources.shopee_terms).toContain("help.shopee.sg");
    expect(config.live_api_inputs.fx_rate).toBe("frankfurter");
  });

  it("keeps reserve formulas numerically consistent with their inputs", () => {
    const returnReserve =
      config.risk_config.return_rate.base * config.risk_config.return_loss_given_return.base;
    const damageReserve =
      config.risk_config.damage_rate.base * config.risk_config.damage_loss_given_damage.base;

    expect(config.risk_config.return_loss_reserve_rate.formula).toBe(
      "return_rate.base * return_loss_given_return.base",
    );
    expect(config.risk_config.return_loss_reserve_rate.base).toBeCloseTo(returnReserve, 6);
    expect(config.risk_config.damage_loss_reserve_rate.formula).toBe(
      "damage_rate.base * damage_loss_given_damage.base",
    );
    expect(config.risk_config.damage_loss_reserve_rate.base).toBeCloseTo(damageReserve, 6);
  });

  it("separates optional program fees from cold-start base fees", () => {
    expect(config.fee_config.optional_program_fee_rate.base).toBe(0);
    expect(config.fee_config.optional_program_fee_rate.high).toBeGreaterThan(0);
    expect(config.fee_config.fee_gst_rate).toBe(0.09);
  });
});
