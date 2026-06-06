export type DeptStatus =
  | "waiting"
  | "running"
  | "complete"
  | "blocked"
  | "review";

export type Decision = "go" | "watch" | "reject";

export interface SellerBrief {
  targetMarket: string; // "Singapore"
  targetPlatform: "Shopee";
  sellerType: string;
  productMode: "have_product" | "know_category" | "recommend";
  categories: string[];
  keywords: string;
  budgetRange: string;
  expectedMargin: string;
  maxFulfillmentDays: number;
  riskPreference: "conservative" | "balanced" | "high_risk";
  language: string;
}

export interface DepartmentResult {
  id: string; // "market", "sourcing", ...
  department: string; // "Market Department"
  shortName: string; // "Market"
  agent: string; // "Market Agent"
  question: string;
  status: DeptStatus;
  keyFinding: string;
  score: number; // 0-100
  evidence: string[];
  /** key→value rows shown in the output stream / detail page */
  outputPreview: { label: string; value: string }[];
  /** narrative used on the Department Detail page */
  mission: string;
  inputUsed: string[];
  reasoning: string;
  warnings: string[];
  impactOnCommittee: string;
}

export interface Opportunity {
  id: string;
  productName: string;
  productDirection: string;
  targetMarkets: string[];
  heroImage: string;
  galleryImages: ProductGalleryImages;
  shopeeUrl: string;
  sourcePrice: string;
  suggestedSellingPrice: string;
  grossMargin: string;
  netProfit: string;
  netMargin: string;
  availableStock: string;
  fulfillmentTime: string;
  marketHeat: string;
  riskLevel: "Low" | "Medium" | "High";
  confidenceScore: number;
  decision: Decision;
  keyReason: string;
  evidenceLinks: EvidenceLink[];
  runSummary: string;
  agentTimeline: AgentTimelineItem[];
  regionSnapshots: RegionSnapshot[];
}

export interface ProductGalleryImages {
  main: string;
  lifestyle: string;
  feature: string;
}

export interface EvidenceLink {
  label: string;
  href: string;
  price: string;
  type: "supplier" | "marketplace" | "demand";
}

export interface AgentTimelineItem {
  agent: string;
  result: string;
  status: DeptStatus;
}

export interface RegionSnapshot {
  market: string;
  priceBand: string;
  buyerAngle: string;
  decision: Decision;
}

export interface PackagingTab {
  id: string;
  label: string;
  status: DeptStatus; // reuse for done/active/waiting dots
}

export interface PackagingOutput {
  productId: string;
  localizedShopeeTitle: string;
  titleCharCount: number;
  sellingPoints: string[];
  productDescription: string;
  positioningAngle: string;
  bundleStrategy: string;
  giftStrategy: string;
  imagePrompts: string[];
  heroImageDirection: string;
  lifestyleImageDirection: string;
  featureImageDirection: string;
  complianceNotes: string[];
  priceUpliftReasoning: string;
}

export interface ShopeeListing {
  productId: string;
  fields: { key: string; value: string; editable: boolean }[];
  preview: {
    image: string; // url or "" for placeholder slot
    title: string;
    price: string;
    bullets: string[];
  };
}
