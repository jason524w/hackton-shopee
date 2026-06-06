import type { AgentResult, Brief, Evidence } from "../../../contract/result";
import type { JsonSchema } from "../../agent-runtime/schemas";
import { makeObjectSchema } from "../../agent-runtime/schemas";
import type { MarketDirection } from "../market/schema";

export interface SourcingAgentInput {
  brief: Brief;
  primary_direction: MarketDirection;
}

export interface PackageDimensions {
  length: number;
  width: number;
  height: number;
}

export interface SourcingSupplierCandidate {
  offer_id: string;
  title: string;
  supplier_name: string;
  supplier_location: string;
  source_price_cny: number;
  source_price_sgd: number;
  moq: number;
  available_stock: number;
  domestic_dispatch_days: number;
  package_weight_g: number;
  package_dimensions_cm: PackageDimensions;
  evidence_label: string;
  source_url: string;
  warnings: string[];
}

export interface ShippingScenarioOutput {
  cost_sgd: number;
  days_min: number;
  days_max: number;
  method: string;
}

export interface SourcingToolSnapshot {
  tool_name: string;
  provider: string;
  mode: "live" | "seed" | "snapshot" | "browser";
  fixture_id: string;
  source_url: string;
  captured_at: string;
}

export interface SourcingOutput {
  agent_result: AgentResult;
  primary_direction_id: string;
  selected_offer_id: string;
  selected_supplier: SourcingSupplierCandidate;
  supplier_candidates: SourcingSupplierCandidate[];
  source_price_sgd: number;
  fulfillment_days: number;
  package_weight_g: number;
  package_dimensions_cm: PackageDimensions;
  shipping: {
    chargeable_weight_g: number;
    low: ShippingScenarioOutput;
    base: ShippingScenarioOutput;
    high: ShippingScenarioOutput;
    assumptions: string[];
  };
  fx: {
    amount: number;
    from: string;
    to: string;
    rate: number;
    converted_amount: number;
  };
  warnings: string[];
  evidence: Evidence[];
  tool_snapshots: SourcingToolSnapshot[];
}

const evidenceSchema = makeObjectSchema({
  label: { type: "string" },
  value: { type: "string" },
});

const dimensionsSchema = makeObjectSchema({
  length: { type: "number", minimum: 0 },
  width: { type: "number", minimum: 0 },
  height: { type: "number", minimum: 0 },
});

const candidateSchema = makeObjectSchema({
  offer_id: { type: "string" },
  title: { type: "string" },
  supplier_name: { type: "string" },
  supplier_location: { type: "string" },
  source_price_cny: { type: "number", minimum: 0 },
  source_price_sgd: { type: "number", minimum: 0 },
  moq: { type: "number", minimum: 0 },
  available_stock: { type: "number", minimum: 0 },
  domestic_dispatch_days: { type: "number", minimum: 0 },
  package_weight_g: { type: "number", minimum: 0 },
  package_dimensions_cm: dimensionsSchema,
  evidence_label: { type: "string" },
  source_url: { type: "string" },
  warnings: { type: "array", items: { type: "string" } },
});

const scenarioSchema = makeObjectSchema({
  cost_sgd: { type: "number", minimum: 0 },
  days_min: { type: "number", minimum: 0 },
  days_max: { type: "number", minimum: 0 },
  method: { type: "string" },
});

const agentResultSchema = makeObjectSchema({
  key: { type: "string", const: "sourcing" },
  name: { type: "string" },
  role: { type: "string" },
  status: { type: "string", enum: ["waiting", "running", "done", "blocked"] },
  inputs_summary: { type: "string" },
  data_sources: { type: "array", items: { type: "string" } },
  evidence: { type: "array", items: evidenceSchema },
  key_judgment: { type: "string" },
  audit_summary: { type: "string" },
  score: { type: "number", minimum: 0, maximum: 100 },
  confidence: { type: "number", minimum: 0, maximum: 1 },
  warnings: { type: "array", items: { type: "string" } },
});

const snapshotSchema = makeObjectSchema({
  tool_name: { type: "string" },
  provider: { type: "string" },
  mode: { type: "string", enum: ["live", "seed", "snapshot", "browser"] },
  fixture_id: { type: "string" },
  source_url: { type: "string" },
  captured_at: { type: "string" },
});

export const sourcingInputSchema: JsonSchema = makeObjectSchema({
  brief: { type: "object", additionalProperties: true },
  primary_direction: { type: "object", additionalProperties: true },
});

export const sourcingOutputSchema: JsonSchema = makeObjectSchema({
  agent_result: agentResultSchema,
  primary_direction_id: { type: "string" },
  selected_offer_id: { type: "string" },
  selected_supplier: candidateSchema,
  supplier_candidates: { type: "array", items: candidateSchema, minItems: 1 },
  source_price_sgd: { type: "number", minimum: 0 },
  fulfillment_days: { type: "number", minimum: 0 },
  package_weight_g: { type: "number", minimum: 0 },
  package_dimensions_cm: dimensionsSchema,
  shipping: makeObjectSchema({
    chargeable_weight_g: { type: "number", minimum: 0 },
    low: scenarioSchema,
    base: scenarioSchema,
    high: scenarioSchema,
    assumptions: { type: "array", items: { type: "string" } },
  }),
  fx: makeObjectSchema({
    amount: { type: "number", minimum: 0 },
    from: { type: "string" },
    to: { type: "string" },
    rate: { type: "number", minimum: 0 },
    converted_amount: { type: "number", minimum: 0 },
  }),
  warnings: { type: "array", items: { type: "string" } },
  evidence: { type: "array", items: evidenceSchema },
  tool_snapshots: { type: "array", items: snapshotSchema },
});
