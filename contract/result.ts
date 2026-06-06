// Sea Launch AI — shared result contract.
// Frontend renders against this; backend's /api/run must return this shape.
// Source of truth alongside contract/mock-result.json.

export type Decision = "Go" | "Watch" | "Reject";
export type RiskLevel = "low" | "medium" | "high";
export type AgentStatus = "waiting" | "running" | "done" | "blocked";
export type AgentKey =
  | "market"
  | "sourcing"
  | "margin"
  | "risk"
  | "listing"
  | "packaging"
  | "committee";

export interface Brief {
  target_market: string;
  target_platform: "Shopee" | "Lazada";
  seller_type: string;
  product_intent: string;
  category: string;
  budget: number;
  target_margin: number; // 0..1
  max_fulfillment_days: number;
  risk_appetite: "conservative" | "balanced" | "aggressive";
  language: string;
}

export interface Evidence {
  label: string;
  value: string;
}

export interface AgentResult {
  key: AgentKey;
  name: string;
  role: string;
  status: AgentStatus;
  inputs_summary: string;
  data_sources: string[];
  evidence: Evidence[];
  key_judgment: string;
  score: number; // 0..100
  confidence: number; // 0..1
  warnings: string[];
  risk_level?: RiskLevel; // present on the risk agent
}

export interface CostLine {
  label: string;
  amount: number; // revenue/net positive, costs negative
  type: "revenue" | "cost" | "net";
}

export interface MarginDetail {
  base: { net_profit: number; net_margin: number };
  low: { net_profit: number; net_margin: number };
  high: { net_profit: number; net_margin: number };
  cost_breakdown: CostLine[];
}

export interface OpportunityScores {
  profit: number;
  demand: number;
  compliance: number;
  fulfillment: number;
  packaging: number;
  overall: number;
}

export interface Opportunity {
  id: string;
  is_primary: boolean;
  name: string;
  direction: string;
  target_market: string;
  target_platform: string;
  source_price: number;
  suggested_price: number;
  minimum_viable_price: number;
  gross_margin: number; // 0..1
  stock_status: "in_stock" | "low" | "out";
  fulfillment_days: number;
  market_heat: "low" | "medium" | "high";
  risk_level: RiskLevel;
  decision: Decision;
  decision_reason: string;
  scores: OpportunityScores;
  margin: MarginDetail | null; // full detail only on the primary opportunity
  key_reasons: string[];
}

export interface Tradeoff {
  opportunity_id: string;
  conflict: string;
  resolution: string;
}

export interface Committee {
  ranked_ids: string[];
  weights: Record<keyof Omit<OpportunityScores, "overall">, number>;
  tradeoffs: Tradeoff[];
  summary: string;
}

export interface ListingImage {
  type: "hero" | "lifestyle" | "feature";
  url: string;
  prompt: string;
  compliance: "ok" | "needs_review" | "rejected";
}

export interface ShopeeListing {
  item_name: string;
  category: string;
  category_id: number;
  brand: string;
  condition: string;
  price: number;
  stock: number;
  sku: string;
  variations: { name: string; options: string[] }[];
  attributes: Record<string, string>;
  description: string;
  bullet_points: string[];
  logistics: { weight_g: number; length_cm: number; width_cm: number; height_cm: number };
  required_fields_total: number;
  required_fields_filled: number;
  missing_fields: string[];
}

export interface SelectedListing {
  opportunity_id: string;
  platform: "Shopee" | "Lazada";
  market: string;
  language: string;
  shopee: ShopeeListing;
  images: ListingImage[];
  compliance: { human_review_required: boolean; warnings: string[] };
  editable_json_ready: boolean;
}

export interface RunResult {
  run_id: string;
  audit_run_id: string; // points to GET /api/runs/:id/audit; full logs NOT inlined here
  created_at: string;
  currency: string;
  brief: Brief;
  agents: AgentResult[];
  opportunities: Opportunity[];
  committee: Committee;
  selected_listing: SelectedListing;
}
