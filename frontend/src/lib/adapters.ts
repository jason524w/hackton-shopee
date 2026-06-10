// Adapters between the shared backend contract (contract/result.ts) and the
// frontend view models (lib/types.ts). This is the ONLY place where the two
// vocabularies meet; pages render view models, the store fills them from a
// live RunResult.
import type {
  AgentResult,
  Brief,
  Decision as ContractDecision,
  ListingImage,
  Opportunity as ContractOpportunity,
  RunResult,
} from "../../../contract/result";
import { DEPARTMENT_META } from "./static-content";
import type {
  Decision,
  DepartmentResult,
  DeptStatus,
  Opportunity,
  PackagingOutput,
  SellerBrief,
  ShopeeListing,
} from "./types";

// ---------- brief: view → contract ----------

const RISK_MAP: Record<SellerBrief["riskPreference"], Brief["risk_appetite"]> = {
  conservative: "conservative",
  balanced: "balanced",
  high_risk: "aggressive",
};

function parseFirstNumber(text: string, fallback: number): number {
  const match = text.replace(/,/g, "").match(/\d+(\.\d+)?/);
  return match ? Number(match[0]) : fallback;
}

export function toBrief(brief: SellerBrief): Brief {
  return {
    target_market: brief.targetMarket,
    target_platform: brief.targetPlatform,
    seller_type: brief.sellerType,
    product_intent: brief.keywords || brief.categories[0] || "",
    category: brief.categories[0] ?? "",
    budget: parseFirstNumber(brief.budgetRange, 500),
    target_margin: parseFirstNumber(brief.expectedMargin, 25) / 100,
    max_fulfillment_days: brief.maxFulfillmentDays,
    risk_appetite: RISK_MAP[brief.riskPreference],
    language: brief.language.toLowerCase().startsWith("en") ? "en" : brief.language,
  };
}

// ---------- agents: contract → departments ----------

const STATUS_MAP: Record<AgentResult["status"], DeptStatus> = {
  waiting: "waiting",
  running: "running",
  done: "complete",
  blocked: "blocked",
};

export function toDepartments(run: RunResult): DepartmentResult[] {
  const byKey = new Map(run.agents.map((agent) => [agent.key, agent]));
  return DEPARTMENT_META.map((meta) => {
    const agent = byKey.get(meta.id as AgentResult["key"]);
    return {
      id: meta.id,
      department: meta.department,
      shortName: meta.shortName,
      agent: meta.agent,
      question: meta.question,
      mission: meta.mission,
      status: agent ? STATUS_MAP[agent.status] : "waiting",
      keyFinding: agent?.key_judgment ?? "",
      score: agent?.score ?? 0,
      evidence: agent?.evidence.map((e) => `${e.label}: ${e.value}`) ?? [],
      outputPreview: agent?.evidence ?? [],
      inputUsed: agent ? [agent.inputs_summary, ...agent.data_sources] : [],
      reasoning: agent?.key_judgment ?? "",
      warnings: agent?.warnings ?? [],
      impactOnCommittee: agent?.warnings.length
        ? `Flags ${agent.warnings.length} warning(s) for the committee.`
        : "Feeds its score into the committee weighting.",
    };
  });
}

// ---------- opportunities: contract → board cards ----------

const DECISION_MAP: Record<ContractDecision, Decision> = {
  Go: "go",
  Watch: "watch",
  Reject: "reject",
};

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function money(currency: string, amount: number): string {
  return `${currency} ${amount.toFixed(2)}`;
}

function imagesByType(images: ListingImage[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const image of images) {
    if (!map[image.type]) map[image.type] = image.url;
  }
  return map;
}

export function toOpportunities(run: RunResult): Opportunity[] {
  return run.opportunities.map((opp) => toOpportunity(opp, run));
}

function toOpportunity(opp: ContractOpportunity, run: RunResult): Opportunity {
  const currency = run.currency;
  const isSelected = run.selected_listing.opportunity_id === opp.id;
  const listingImages = isSelected ? imagesByType(run.selected_listing.images) : {};
  const margin = opp.margin?.base;

  return {
    id: opp.id,
    productName: opp.name,
    productDirection: opp.direction,
    targetMarkets: [opp.target_market],
    heroImage: listingImages.hero ?? "",
    galleryImages: {
      main: listingImages.hero ?? "",
      lifestyle: listingImages.lifestyle ?? "",
      feature: listingImages.feature ?? "",
    },
    shopeeUrl: "",
    sourcePrice: money(currency, opp.source_price),
    suggestedSellingPrice: money(currency, opp.suggested_price),
    grossMargin: `${Math.round(opp.gross_margin * 100)}%`,
    netProfit: margin ? money(currency, margin.net_profit) : "—",
    netMargin: margin ? `${Math.round(margin.net_margin * 100)}%` : "—",
    availableStock: opp.stock_status === "in_stock" ? "In stock" : capitalize(opp.stock_status),
    fulfillmentTime: `${opp.fulfillment_days} days`,
    marketHeat: capitalize(opp.market_heat),
    riskLevel: capitalize(opp.risk_level) as Opportunity["riskLevel"],
    confidenceScore: opp.scores.overall,
    decision: DECISION_MAP[opp.decision],
    keyReason: opp.decision_reason,
    evidenceLinks: [],
    runSummary: opp.key_reasons.join(" "),
    agentTimeline: run.agents.map((agent) => ({
      agent: agent.name,
      result: agent.key_judgment,
      status: STATUS_MAP[agent.status],
    })),
    regionSnapshots: [],
  };
}

// ---------- selected listing: contract → packaging / listing views ----------

export function toPackaging(run: RunResult): PackagingOutput {
  const listing = run.selected_listing;
  const shopee = listing.shopee;
  const prompts = new Map(listing.images.map((image) => [image.type, image.prompt]));

  return {
    productId: listing.opportunity_id,
    localizedShopeeTitle: shopee.item_name,
    titleCharCount: shopee.item_name.length,
    sellingPoints: shopee.bullet_points,
    productDescription: shopee.description,
    positioningAngle: shopee.bullet_points[0] ?? "",
    bundleStrategy: "",
    giftStrategy: "",
    imagePrompts: listing.images.map((image) => image.prompt),
    heroImageDirection: prompts.get("hero") ?? "",
    lifestyleImageDirection: prompts.get("lifestyle") ?? "",
    featureImageDirection: prompts.get("feature") ?? "",
    complianceNotes: listing.compliance.warnings,
    priceUpliftReasoning: "",
  };
}

export function toListing(run: RunResult): ShopeeListing {
  const listing = run.selected_listing;
  const shopee = listing.shopee;
  const images = imagesByType(listing.images);

  const fields: ShopeeListing["fields"] = [
    { key: "Item name", value: shopee.item_name, editable: true },
    { key: "Category", value: shopee.category, editable: false },
    { key: "Brand", value: shopee.brand, editable: true },
    { key: "Condition", value: shopee.condition, editable: false },
    { key: "Price", value: money(run.currency, shopee.price), editable: true },
    { key: "Stock", value: String(shopee.stock), editable: true },
    { key: "SKU", value: shopee.sku, editable: true },
    {
      key: "Weight / size",
      value: `${shopee.logistics.weight_g} g · ${shopee.logistics.length_cm}×${shopee.logistics.width_cm}×${shopee.logistics.height_cm} cm`,
      editable: false,
    },
    ...Object.entries(shopee.attributes).map(([key, value]) => ({ key, value, editable: true })),
  ];

  return {
    productId: listing.opportunity_id,
    fields,
    preview: {
      image: images.hero ?? "",
      title: shopee.item_name,
      price: money(run.currency, shopee.price),
      bullets: shopee.bullet_points,
    },
  };
}

// ---------- progressive status from audit polling ----------

const AUDIT_STATUS_MAP: Record<string, DeptStatus> = {
  running: "running",
  completed: "complete",
  failed: "blocked",
};

// Applies audit snapshots onto the department list while a run is in flight:
// agents with a snapshot get its status; the first agent without one is "running"
// (pipeline is sequential), the rest stay "waiting".
export function applyAuditStatuses(
  departments: DepartmentResult[],
  snapshots: Array<{ agent_key: string; status: string }>,
): DepartmentResult[] {
  const byKey = new Map(snapshots.map((snap) => [snap.agent_key, snap.status]));
  let nextIsRunning = true;
  return departments.map((dept) => {
    const auditStatus = byKey.get(dept.id);
    if (auditStatus) {
      if (auditStatus !== "completed") nextIsRunning = false;
      return { ...dept, status: AUDIT_STATUS_MAP[auditStatus] ?? dept.status };
    }
    if (nextIsRunning) {
      nextIsRunning = false;
      return { ...dept, status: "running" };
    }
    return { ...dept, status: "waiting" };
  });
}

// ---------- committee: contract → committee view ----------

const WEIGHT_LABELS: Record<string, string> = {
  profit: "Profit viability",
  demand: "Market demand",
  compliance: "Compliance risk",
  fulfillment: "Fulfillment feasibility",
  packaging: "Packaging / listing readiness",
};

export interface CommitteeView {
  decision: Decision;
  confidence: number; // 0..100, percentage points
  summary: string;
  recommendedAction: string;
  weights: { dimension: string; weight: number; label: string }[]; // weight 0..1, label e.g. "30%"
  tradeoffs: { product: string; conflict: string; resolution: string }[];
  scoreMatrix: { name: string; score: number; finding: string; state: string }[];
}

export function toCommittee(run: RunResult): CommitteeView {
  const committee = run.committee;
  const committeeAgent = run.agents.find((a) => a.key === "committee");

  // The headline verdict is for the opportunity the seller is actually reviewing:
  // the flagged primary (== the selected listing). This is the demo climax — e.g.
  // the desk vacuum lands on Watch, NOT Go. The committee's ranked order is a
  // separate portfolio recommendation surfaced on the board, not the headline.
  const primary =
    run.opportunities.find((o) => o.id === run.selected_listing.opportunity_id) ??
    run.opportunities.find((o) => o.is_primary) ??
    run.opportunities.find((o) => committee.ranked_ids.includes(o.id)) ??
    run.opportunities[0];

  const decision: Decision = primary ? DECISION_MAP[primary.decision] : "watch";
  // Prefer the committee agent's own confidence; fall back to the primary's overall score.
  const confidence =
    committeeAgent && typeof committeeAgent.confidence === "number"
      ? Math.round(committeeAgent.confidence * 100)
      : primary
        ? Math.round(primary.scores.overall)
        : 0;

  const actionByDecision: Record<Decision, string> = {
    go: "Select for Packaging Studio and launch.",
    watch: "Hold for human review before launch — see tradeoffs below.",
    reject: "Do not launch — committee blocked this direction.",
  };

  const weights = Object.entries(committee.weights).map(([dimension, weight]) => ({
    dimension,
    weight,
    label: `${Math.round(weight * 100)}%`,
  }));

  const tradeoffs = committee.tradeoffs.map((t) => {
    const opp = run.opportunities.find((o) => o.id === t.opportunity_id);
    return {
      product: opp?.name ?? t.opportunity_id,
      conflict: t.conflict,
      resolution: t.resolution,
    };
  });

  const scoreMatrix = run.agents
    .filter((a) => a.key !== "committee")
    .map((a) => ({
      name:
        DEPARTMENT_META.find((m) => m.id === a.key)?.department ?? a.name,
      score: a.score,
      finding: a.key_judgment,
      state: a.warnings.length > 0 ? "Warning" : a.key === "listing" ? "Ready" : "Positive",
    }));

  return {
    decision,
    confidence,
    summary: committee.summary,
    recommendedAction: actionByDecision[decision],
    weights,
    tradeoffs,
    scoreMatrix,
  };
}

export function weightLabel(dimension: string): string {
  return WEIGHT_LABELS[dimension] ?? dimension;
}

// ---------- board summary ----------

export interface BoardSummary {
  found: number;
  go: number;
  watch: number;
  reject: number;
  avgMargin: string;
  riskFlags: number;
}

export function toBoardSummary(run: RunResult): BoardSummary {
  const opportunities = run.opportunities;
  const margins = opportunities
    .map((o) => o.margin?.base.net_margin)
    .filter((m): m is number => typeof m === "number");
  const avg = margins.length ? margins.reduce((a, b) => a + b, 0) / margins.length : 0;
  const riskFlags = run.agents.reduce((count, agent) => count + agent.warnings.length, 0);

  return {
    found: opportunities.length,
    go: opportunities.filter((o) => o.decision === "Go").length,
    watch: opportunities.filter((o) => o.decision === "Watch").length,
    reject: opportunities.filter((o) => o.decision === "Reject").length,
    avgMargin: `${Math.round(avg * 100)}%`,
    riskFlags,
  };
}
