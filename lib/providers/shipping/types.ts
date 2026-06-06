import type { ProviderResultMeta } from "../shared";

export interface ShippingEstimateInput {
  weight_g: number;
  dimensions_cm: { length: number; width: number; height: number };
  from: string;
  to: string;
}

export interface ShippingScenario {
  cost_sgd: number;
  days_min: number;
  days_max: number;
  method: string;
}

export interface ShippingEstimateResult extends ProviderResultMeta {
  from: string;
  to: string;
  chargeable_weight_g: number;
  scenarios: {
    low: ShippingScenario;
    base: ShippingScenario;
    high: ShippingScenario;
  };
  assumptions: string[];
}

export interface ShippingProvider {
  estimateCrossBorder(input: ShippingEstimateInput): Promise<ShippingEstimateResult>;
}
