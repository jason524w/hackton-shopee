// Static presentation copy. This file holds UI text and form defaults only —
// NO pipeline output data. Live results come from /api/run via lib/api.ts.
import type { PackagingTab, SellerBrief } from "./types";

// Default values for the brief form (user input prefill, not pipeline output).
export const DEMO_BRIEF: SellerBrief = {
  targetMarket: "Singapore",
  targetPlatform: "Shopee",
  sellerType: "Solo seller",
  productMode: "have_product",
  categories: ["Home Appliances", "Electronics accessories"],
  keywords: "mini desk vacuum",
  budgetRange: "SGD 500 – 2,000",
  expectedMargin: "30%",
  maxFulfillmentDays: 14,
  riskPreference: "balanced",
  language: "English",
};

export interface DepartmentMeta {
  id: string;
  department: string;
  shortName: string;
  agent: string;
  question: string;
  mission: string;
}

// Stable copy describing each department; merged with live AgentResult slices.
export const DEPARTMENT_META: DepartmentMeta[] = [
  {
    id: "market",
    department: "Market Department",
    shortName: "Market",
    agent: "Market Agent",
    question: "Which products actually have demand?",
    mission: "Judge market heat, search trends, competitor landscape, price band and platform opportunity.",
  },
  {
    id: "sourcing",
    department: "Sourcing Department",
    shortName: "Sourcing",
    agent: "Sourcing Agent",
    question: "Can we find stable, low-cost suppliers?",
    mission: "Find usable supply; judge suppliers, stock, MOQ, fulfillment stability and feasibility.",
  },
  {
    id: "margin",
    department: "Margin Department",
    shortName: "Margin",
    agent: "Margin Agent",
    question: "Does it still profit after every fee?",
    mission: "Compute real profit: price, cost, platform fees, logistics, ad room, and low/base/high scenarios.",
  },
  {
    id: "risk",
    department: "Risk Department",
    shortName: "Risk",
    agent: "Risk Agent",
    question: "Is it safe to sell under Shopee rules?",
    mission: "Judge platform rules, compliance, infringement, exaggerated claims, battery/electronic safety.",
  },
  {
    id: "listing",
    department: "Listing Department",
    shortName: "Listing",
    agent: "Listing Agent",
    question: "How do we turn it into a Shopee page?",
    mission: "Generate title, selling points, keywords, image prompts, description and Shopee fields.",
  },
  {
    id: "packaging",
    department: "Packaging Department",
    shortName: "Packaging",
    agent: "Packaging Agent",
    question: "How do we make it sell for more?",
    mission: "Design packaging, bundle, gift, differentiation and visual expression to improve appeal.",
  },
  {
    id: "committee",
    department: "Committee Department",
    shortName: "Committee",
    agent: "Committee Agent",
    question: "Go / Watch / Reject — the final call.",
    mission: "Aggregate all departments, resolve conflicts, and output Go / Watch / Reject.",
  },
];

export const PACKAGING_TABS: PackagingTab[] = [
  { id: "brief", label: "Product Brief", status: "complete" },
  { id: "title", label: "Shopee Title", status: "running" },
  { id: "points", label: "Selling Points", status: "complete" },
  { id: "positioning", label: "Positioning", status: "waiting" },
  { id: "bundle", label: "Bundle Strategy", status: "waiting" },
  { id: "gift", label: "Gift Strategy", status: "waiting" },
  { id: "prompts", label: "Image Prompts", status: "waiting" },
  { id: "main", label: "Main Image", status: "waiting" },
  { id: "lifestyle", label: "Lifestyle Image", status: "waiting" },
  { id: "feature", label: "Feature Image", status: "waiting" },
  { id: "preview", label: "Listing Preview", status: "waiting" },
  { id: "compliance", label: "Compliance Notes", status: "waiting" },
];

// Marketing homepage stats (static claims, not run output).
export const HOMEPAGE_STATS = [
  { value: 5, suffix: " products", label: "validated per run", sub: "market · margin · risk" },
  { prefix: "SGD ", value: 14.9, decimals: 2, label: "avg suggested price", sub: "from SGD 3.80 cost" },
  { value: 31, suffix: "%", label: "net margin after", sub: "fees · shipping · returns" },
  { value: 11, suffix: " min", label: "brief to Shopee-ready", sub: "launch pack" },
];
