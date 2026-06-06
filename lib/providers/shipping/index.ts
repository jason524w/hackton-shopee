import { readSeedJson, roundMoney } from "../shared";
import { createEasyshipShippingProvider } from "./easyship";
import type { ShippingEstimateInput, ShippingEstimateResult, ShippingProvider, ShippingScenario } from "./types";

interface ShippingSeed {
  fixture_id: string;
  captured_at: string;
  routes: Array<{
    from: string;
    to: string;
    method: string;
    base_fee_sgd: number;
    per_100g_sgd: number;
    volumetric_divisor: number;
    days_min: number;
    days_max: number;
    assumptions: string[];
  }>;
}

// Route codes in seed data are ISO-ish ("CN", "SG") but models pass free-text
// place names ("Guangzhou, Guangdong, China"). Match leniently on aliases.
const REGION_ALIASES: Record<string, string[]> = {
  cn: ["cn", "china", "guangzhou", "shenzhen", "yiwu", "dongguan", "zhejiang", "guangdong", "prc", "中国"],
  sg: ["sg", "singapore", "新加坡"],
};

function matchesRegion(routeCode: string, input: string): boolean {
  const code = routeCode.trim().toLowerCase();
  const text = input.trim().toLowerCase();
  if (code === text) return true;
  const aliases = REGION_ALIASES[code] ?? [code];
  return aliases.some((alias) => text === alias || text.includes(alias));
}

export function createSeedShippingProvider(): ShippingProvider {
  return {
    async estimateCrossBorder(input: ShippingEstimateInput): Promise<ShippingEstimateResult> {
      const seed = await readSeedJson<ShippingSeed>("seed/shipping/cn-to-sg-rates.json");
      const route = seed.routes.find(
        (candidate) =>
          matchesRegion(candidate.from, input.from) && matchesRegion(candidate.to, input.to),
      );
      if (!route) {
        throw new Error(`Shipping route not found from=${input.from} to=${input.to}`);
      }

      const volumetricWeight = Math.ceil(
        (input.dimensions_cm.length * input.dimensions_cm.width * input.dimensions_cm.height) /
          route.volumetric_divisor,
      );
      const chargeableWeight = Math.max(input.weight_g, volumetricWeight);
      const unitCount = Math.ceil(chargeableWeight / 100);
      const baseCost = route.base_fee_sgd + unitCount * route.per_100g_sgd;

      return {
        source: {
          provider: "shipping",
          mode: "seed",
          fixture_id: seed.fixture_id,
          captured_at: seed.captured_at,
        },
        from: input.from,
        to: input.to,
        chargeable_weight_g: chargeableWeight,
        scenarios: {
          low: scenario(route.method, baseCost * 0.85, route.days_min, route.days_max - 1),
          base: scenario(route.method, baseCost, route.days_min, route.days_max),
          high: scenario(route.method, baseCost * 1.35, route.days_min + 1, route.days_max + 3),
        },
        assumptions: route.assumptions,
      };
    },
  };
}

export function createShippingProviderFromEnv(): ShippingProvider {
  return process.env.LOGISTICS_PROVIDER === "easyship"
    ? createEasyshipShippingProvider()
    : createSeedShippingProvider();
}

export const shippingProvider = createShippingProviderFromEnv();
export { createEasyshipShippingProvider };
export type * from "./types";

function scenario(method: string, cost: number, daysMin: number, daysMax: number): ShippingScenario {
  return {
    method,
    cost_sgd: roundMoney(cost),
    days_min: Math.max(1, daysMin),
    days_max: Math.max(daysMin, daysMax),
  };
}
