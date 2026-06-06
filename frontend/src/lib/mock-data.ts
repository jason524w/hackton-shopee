import type {
  DepartmentResult,
  Opportunity,
  PackagingOutput,
  PackagingTab,
  SellerBrief,
  ShopeeListing,
} from "./types";

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

export const DEPARTMENTS: DepartmentResult[] = [
  {
    id: "market",
    department: "Market Department",
    shortName: "Market",
    agent: "Market Agent",
    question: "Which products actually have demand?",
    status: "complete",
    keyFinding:
      "Mini desk vacuum has visible demand in Shopee Singapore — office and student desk scenarios.",
    score: 82,
    evidence: [
      "Steady search interest for 'desk vacuum' and 'keyboard cleaner'.",
      "Medium competitor density — room for a differentiated listing.",
      "Strong review counts on adjacent desk-cleaning tools.",
    ],
    outputPreview: [
      { label: "market_heat", value: "Medium-high" },
      { label: "competitor_density", value: "Medium" },
      { label: "price_band", value: "SGD 8.90 – 19.90" },
    ],
    mission:
      "Judge market heat, search trends, competitor landscape, price band and platform opportunity.",
    inputUsed: ["keyword: mini desk vacuum", "market: Singapore", "platform: Shopee"],
    reasoning:
      "Sampled Shopee SG search results and adjacent categories; estimated demand from competitor review velocity and price clustering.",
    warnings: [],
    impactOnCommittee: "Raises overall confidence — demand is the strongest signal.",
  },
  {
    id: "sourcing",
    department: "Sourcing Department",
    shortName: "Sourcing",
    agent: "Sourcing Agent",
    question: "Can we find stable, low-cost suppliers?",
    status: "complete",
    keyFinding: "3 viable suppliers found. MOQ from 50 units. Fulfillment 10–14 days.",
    score: 76,
    evidence: [
      "3 suppliers with consistent stock history.",
      "Unit cost SGD 3.20–4.50 depending on MOQ.",
      "Two suppliers offer SG-friendly shipping.",
    ],
    outputPreview: [
      { label: "source_price", value: "SGD 3.20 – 4.50" },
      { label: "MOQ", value: "50 units" },
      { label: "reliability", value: "Medium-high" },
    ],
    mission:
      "Find usable supply; judge suppliers, stock, MOQ, fulfillment stability and feasibility.",
    inputUsed: ["product: mini desk vacuum", "budget: SGD 500–2,000"],
    reasoning:
      "Matched product against supplier catalogues; ranked by stock consistency and landed cost.",
    warnings: ["One supplier has inconsistent lead times — avoid for first run."],
    impactOnCommittee: "Supports Go — supply is feasible within budget.",
  },
  {
    id: "margin",
    department: "Margin Department",
    shortName: "Margin",
    agent: "Margin Agent",
    question: "Does it still profit after every fee?",
    status: "running",
    keyFinding:
      "Base scenario nets 31% margin after platform fees, shipping and return reserve.",
    score: 78,
    evidence: [
      "Suggested price SGD 14.90 vs SGD 3.80 landed cost.",
      "Platform + payment fees ~ SGD 1.60.",
      "Return reserve and packaging modeled at SGD 0.90.",
    ],
    outputPreview: [
      { label: "suggested_price", value: "SGD 14.90" },
      { label: "net_margin", value: "31%" },
      { label: "scenario", value: "low 22% · base 31% · high 38%" },
    ],
    mission:
      "Compute real profit: price, cost, platform fees, logistics, ad room, and low/base/high scenarios.",
    inputUsed: ["source_price: SGD 3.80", "price_band: SGD 8.90–19.90"],
    reasoning:
      "Modeled net margin across low/base/high price and return assumptions; included Shopee SG fee schedule.",
    warnings: [],
    impactOnCommittee: "Base margin clears the 30% target — supports Go.",
  },
  {
    id: "risk",
    department: "Risk Department",
    shortName: "Risk",
    agent: "Risk Agent",
    question: "Is it safe to sell under Shopee rules?",
    status: "waiting",
    keyFinding: "Low risk overall; avoid exaggerated suction/medical claims.",
    score: 71,
    evidence: [
      "No battery-shipping red flags for USB-rechargeable unit.",
      "No trademark conflicts on generic naming.",
      "Claim language must avoid 'medical-grade' wording.",
    ],
    outputPreview: [
      { label: "risk_level", value: "Low" },
      { label: "violation_flags", value: "None hard" },
      { label: "note", value: "Avoid exaggerated claims" },
    ],
    mission:
      "Judge platform rules, compliance, infringement, exaggerated claims, battery/electronic safety.",
    inputUsed: ["product specs", "listing draft"],
    reasoning:
      "Checked Shopee SG prohibited/claim rules and battery shipping guidance.",
    warnings: ["Exaggerated suction claims would trigger review."],
    impactOnCommittee: "No blockers — Watch only if claims are aggressive.",
  },
  {
    id: "listing",
    department: "Listing Department",
    shortName: "Listing",
    agent: "Listing Agent",
    question: "How do we turn it into a Shopee page?",
    status: "waiting",
    keyFinding: "All Shopee fields can be generated; title and attributes ready.",
    score: 80,
    evidence: [
      "Category maps to Home Appliances › Vacuum Cleaners.",
      "Title fits Shopee length with primary keywords.",
      "Required attributes available from specs.",
    ],
    outputPreview: [
      { label: "category", value: "Home Appliances › Vacuum" },
      { label: "fields", value: "Complete" },
      { label: "title_len", value: "74 chars" },
    ],
    mission:
      "Generate title, selling points, keywords, image prompts, description and Shopee fields.",
    inputUsed: ["packaging output", "category attributes"],
    reasoning: "Mapped product to Shopee taxonomy and required field set.",
    warnings: [],
    impactOnCommittee: "Listing readiness supports Go.",
  },
  {
    id: "packaging",
    department: "Packaging Department",
    shortName: "Packaging",
    agent: "Packaging Agent",
    question: "How do we make it sell for more?",
    status: "waiting",
    keyFinding:
      "Bundle, gift and localized visual strategy can lift perceived value without risky claims.",
    score: 79,
    evidence: [
      "Desk vacuum becomes a cleaning kit with brush and pouch.",
      "Dehumidifier needs humidity-card bundle to make value visible.",
      "SG/MY visual packs can localize use cases without changing product truth.",
    ],
    outputPreview: [
      { label: "bundle", value: "Product + practical accessory + care card" },
      { label: "visual_pack", value: "Cover · lifestyle · feature modules" },
      { label: "uplift", value: "Higher perceived value, human-reviewed claims" },
    ],
    mission:
      "Design packaging, bundle, gift, differentiation and visual expression to improve appeal.",
    inputUsed: ["selected product", "market angle", "risk notes", "margin target"],
    reasoning:
      "Mapped each product into a localized bundle and image sequence that makes the use case obvious to SG/MY buyers.",
    warnings: ["Confirm included accessories before publishing bundle images."],
    impactOnCommittee:
      "Improves the Go case for low-risk items and keeps medium-risk items behind review.",
  },
  {
    id: "committee",
    department: "Committee Department",
    shortName: "Committee",
    agent: "Committee Agent",
    question: "Go / Watch / Reject — the final call.",
    status: "waiting",
    keyFinding: "Go. Demand, supply and margin align; risk is manageable.",
    score: 82,
    evidence: [
      "Profit viability strong (weight 30%).",
      "Market demand visible (weight 25%).",
      "Compliance risk low (weight 20%).",
    ],
    outputPreview: [
      { label: "decision", value: "Go" },
      { label: "confidence", value: "82%" },
      { label: "next", value: "Select for Packaging Studio" },
    ],
    mission:
      "Aggregate all departments, resolve conflicts, and output Go / Watch / Reject.",
    inputUsed: ["all department scores"],
    reasoning:
      "Weighted profit 30% · demand 25% · risk 20% · fulfillment 15% · listing 10%.",
    warnings: [],
    impactOnCommittee: "This is the Committee.",
  },
];

export const OPPORTUNITIES: Opportunity[] = [
  {
    id: "mini-desk-vacuum",
    productName: "Mini Desk Vacuum",
    productDirection: "Office · Student desk · HDB home",
    targetMarkets: ["Singapore", "Malaysia"],
    heroImage: "/assets/mini-desk-vacuum-pack.png",
    galleryImages: {
      main: "/assets/mini-desk-vacuum-main.png",
      lifestyle: "/assets/mini-desk-vacuum-lifestyle.png",
      feature: "/assets/mini-desk-vacuum-feature.png",
    },
    shopeeUrl:
      "https://shopee.sg/Cute-Mini-Desktop-Vacuum-Cleaner-Perfect-for-Eraser-Shavings-Desk-Crumbs-USB-Rechargeable-i.120585555.53507889742",
    sourcePrice: "USD 5.49",
    suggestedSellingPrice: "SGD 13.90–16.99",
    grossMargin: "46%",
    netProfit: "SGD 3.80",
    netMargin: "27%",
    availableStock: "In stock",
    fulfillmentTime: "7–14 days",
    marketHeat: "Medium-high",
    riskLevel: "Low",
    confidenceScore: 82,
    decision: "go",
    keyReason: "Clear desk-cleaning scenario, low compliance risk, and visible SG/MY resale band.",
    runSummary:
      "The agents found an entry-priced desk cleaning product with enough marketplace spread to justify a bundled listing, especially when positioned for HDB home office and student desks.",
    evidenceLinks: [
      {
        label: "Alibaba supplier example",
        href: "https://www.alibaba.co.uk/product-detail/6000-Pa-Strong-Power-USB-Rechargeable_1600112417947.html",
        price: "USB mini vacuum supplier listing",
        type: "supplier",
      },
      {
        label: "Shopee SG product example",
        href: "https://shopee.sg/Cute-Mini-Desktop-Vacuum-Cleaner-Perfect-for-Eraser-Shavings-Desk-Crumbs-USB-Rechargeable-i.120585555.53507889742",
        price: "SG desk vacuum listing",
        type: "marketplace",
      },
      {
        label: "Shopee MY price band",
        href: "https://shopee.com.my/list/vacuum/mini/desk",
        price: "RM 13.50–25.90 observed list band",
        type: "marketplace",
      },
    ],
    agentTimeline: [
      { agent: "Market Agent", result: "Medium-high demand in desk, student, and keyboard-cleaning searches.", status: "complete" },
      { agent: "Sourcing Agent", result: "Supplier options exist with compact USB rechargeable variants.", status: "complete" },
      { agent: "Margin Agent", result: "Profitable only if sold as a kit, not as a bare commodity gadget.", status: "complete" },
      { agent: "Risk Agent", result: "Low risk; avoid exaggerated suction and battery claims.", status: "complete" },
      { agent: "Committee Agent", result: "GO for bundled launch pack.", status: "complete" },
    ],
    regionSnapshots: [
      {
        market: "Singapore",
        priceBand: "SGD 13.90–16.99",
        buyerAngle: "HDB desk, keyboard crumbs, compact home office",
        decision: "go",
      },
      {
        market: "Malaysia",
        priceBand: "RM 13.50–25.90",
        buyerAngle: "Student desk and gaming desk cleanup",
        decision: "go",
      },
    ],
  },
  {
    id: "cable-organizer",
    productName: "Cable Organizer Set",
    productDirection: "WFH · Travel · Desk setup",
    targetMarkets: ["Singapore", "Malaysia"],
    heroImage: "/assets/cable-organizer-pack.png",
    galleryImages: {
      main: "/assets/cable-organizer-main.png",
      lifestyle: "/assets/cable-organizer-lifestyle.png",
      feature: "/assets/cable-organizer-feature.png",
    },
    shopeeUrl: "https://shopee.sg/search?keyword=cable%20organizer%20set",
    sourcePrice: "USD 0.80–1.50",
    suggestedSellingPrice: "SGD 5.90–12.90",
    grossMargin: "62%",
    netProfit: "SGD 2.20",
    netMargin: "34%",
    availableStock: "In stock",
    fulfillmentTime: "7–12 days",
    marketHeat: "Medium",
    riskLevel: "Low",
    confidenceScore: 78,
    decision: "go",
    keyReason: "Low-risk desk accessory with low landed cost, simple bundling, and strong setup visuals.",
    runSummary:
      "The agents picked a lightweight desk cable kit because it is cheap to source, easy to fulfill, and can be repositioned from commodity clips into a tidy desk setup bundle for SG/MY home-office buyers.",
    evidenceLinks: [
      {
        label: "Alibaba cable organizer suppliers",
        href: "https://www.alibaba.com/showroom/cable-organizer-set.html",
        price: "Bulk cable clip and box supplier search",
        type: "supplier",
      },
      {
        label: "Shopee SG cable organizer search",
        href: "https://shopee.sg/search?keyword=cable%20organizer%20set",
        price: "SGD 3.90–12.90 observed list band",
        type: "marketplace",
      },
      {
        label: "Shopee MY cable organizer search",
        href: "https://shopee.com.my/search?keyword=cable%20organizer%20set",
        price: "RM 5.90–19.90 observed list band",
        type: "marketplace",
      },
    ],
    agentTimeline: [
      { agent: "Market Agent", result: "Stable demand across desk setup, WFH, and gaming cable keywords.", status: "complete" },
      { agent: "Sourcing Agent", result: "Many low-MOQ suppliers for clips, ties, and cable boxes.", status: "complete" },
      { agent: "Margin Agent", result: "Best margin comes from selling as a tidy desk kit, not single clips.", status: "complete" },
      { agent: "Risk Agent", result: "Low compliance risk; avoid overclaiming adhesive residue performance.", status: "complete" },
      { agent: "Committee Agent", result: "GO as a low-risk accessory launch.", status: "complete" },
    ],
    regionSnapshots: [
      {
        market: "Singapore",
        priceBand: "SGD 5.90–12.90",
        buyerAngle: "HDB home office, WFH desk, renter-friendly setup",
        decision: "go",
      },
      {
        market: "Malaysia",
        priceBand: "RM 5.90–19.90",
        buyerAngle: "Student gaming desk and small apartment cable cleanup",
        decision: "go",
      },
    ],
  },
  {
    id: "pet-grooming-tool",
    productName: "Pet Grooming Tool",
    productDirection: "Cats · Small dogs · HDB living",
    targetMarkets: ["Singapore", "Malaysia"],
    heroImage: "/assets/pet-grooming-tool-pack.png",
    galleryImages: {
      main: "/assets/pet-grooming-tool-main.png",
      lifestyle: "/assets/pet-grooming-tool-lifestyle.png",
      feature: "/assets/pet-grooming-tool-feature.png",
    },
    shopeeUrl: "https://shopee.sg/search?keyword=pet%20grooming%20brush",
    sourcePrice: "USD 1.20–2.80",
    suggestedSellingPrice: "SGD 7.90–16.90",
    grossMargin: "58%",
    netProfit: "SGD 2.80",
    netMargin: "30%",
    availableStock: "In stock",
    fulfillmentTime: "7–14 days",
    marketHeat: "Medium-high",
    riskLevel: "Low",
    confidenceScore: 74,
    decision: "go",
    keyReason: "Clear daily-use pet care scenario, low shipping weight, and strong visual proof for shedding control.",
    runSummary:
      "The agents found a pet-care accessory with repeat-use appeal and enough price spread to justify a gentle-care bundle, especially for small homes where loose fur is a visible pain point.",
    evidenceLinks: [
      {
        label: "Alibaba pet grooming brush suppliers",
        href: "https://www.alibaba.com/showroom/pet-grooming-brush.html",
        price: "Self-cleaning brush supplier search",
        type: "supplier",
      },
      {
        label: "Shopee SG pet grooming brush search",
        href: "https://shopee.sg/search?keyword=pet%20grooming%20brush",
        price: "SGD 6.90–18.90 observed list band",
        type: "marketplace",
      },
      {
        label: "Shopee MY pet grooming brush search",
        href: "https://shopee.com.my/search?keyword=pet%20grooming%20brush",
        price: "RM 8.90–29.90 observed list band",
        type: "marketplace",
      },
    ],
    agentTimeline: [
      { agent: "Market Agent", result: "Healthy demand around shedding, cat brush, and small-dog grooming.", status: "complete" },
      { agent: "Sourcing Agent", result: "Self-cleaning brush variants are widely available with low unit cost.", status: "complete" },
      { agent: "Margin Agent", result: "Bundle with bath brush or storage pouch keeps margin near target.", status: "complete" },
      { agent: "Risk Agent", result: "Low risk if claims stay on grooming comfort, not medical skin treatment.", status: "complete" },
      { agent: "Committee Agent", result: "GO for pet-care listing with gentle-use positioning.", status: "complete" },
    ],
    regionSnapshots: [
      {
        market: "Singapore",
        priceBand: "SGD 7.90–16.90",
        buyerAngle: "Cats and small dogs in HDB homes, loose fur on sofa",
        decision: "go",
      },
      {
        market: "Malaysia",
        priceBand: "RM 8.90–29.90",
        buyerAngle: "Daily grooming for cats and small dogs at home",
        decision: "go",
      },
    ],
  },
  {
    id: "portable-dehumidifier",
    productName: "Portable Dehumidifier",
    productDirection: "HDB bedroom · Wardrobe · Laundry corner",
    targetMarkets: ["Singapore", "Malaysia"],
    heroImage: "/assets/portable-dehumidifier-pack.png",
    galleryImages: {
      main: "/assets/portable-dehumidifier-main.png",
      lifestyle: "/assets/portable-dehumidifier-lifestyle.png",
      feature: "/assets/portable-dehumidifier-feature.png",
    },
    shopeeUrl: "https://shopee.sg/search?keyword=portable+dehumidifier",
    sourcePrice: "USD 22.99",
    suggestedSellingPrice: "SGD 33.80–59.90",
    grossMargin: "37%",
    netProfit: "SGD 4.20",
    netMargin: "12%",
    availableStock: "Low stock",
    fulfillmentTime: "14–21 days",
    marketHeat: "High",
    riskLevel: "Medium",
    confidenceScore: 66,
    decision: "watch",
    keyReason: "Strong humid-climate demand, but electronics, returns, and warranty risk compress margin.",
    runSummary:
      "The agents found real climate-driven demand in SG/MY, but the committee kept it at Watch because the apparent resale spread can disappear after electronics support, return reserve, and plug/warranty handling.",
    evidenceLinks: [
      {
        label: "Alibaba 700ml supplier example",
        href: "https://www.alibaba.com/product-introduction/INVITOP-New-Style-700ml-Easy-Home_60693899836.html",
        price: "USD 22.99 supplier listing",
        type: "supplier",
      },
      {
        label: "Shopee SG search band",
        href: "https://shopee.sg/search?keyword=portable+dehumidifier",
        price: "SGD 13.90–48.00 observed list band",
        type: "marketplace",
      },
      {
        label: "Shopee MY search band",
        href: "https://shopee.com.my/list/dehumidifier",
        price: "RM 82.70–170.00 observed list band",
        type: "marketplace",
      },
    ],
    agentTimeline: [
      { agent: "Market Agent", result: "High demand signal in humid city living, wardrobe, and bedroom use cases.", status: "complete" },
      { agent: "Sourcing Agent", result: "700ml supplier examples exist, but MOQ and plug variants need confirmation.", status: "complete" },
      { agent: "Margin Agent", result: "Margin is fragile after electronics warranty and return reserve.", status: "review" },
      { agent: "Risk Agent", result: "Medium risk due to electrical safety, plug type, and performance claims.", status: "review" },
      { agent: "Committee Agent", result: "WATCH until supplier warranty and landed cost are locked.", status: "complete" },
    ],
    regionSnapshots: [
      {
        market: "Singapore",
        priceBand: "SGD 33.80–59.90",
        buyerAngle: "Wardrobe humidity and rainy-season bedroom storage",
        decision: "watch",
      },
      {
        market: "Malaysia",
        priceBand: "RM 82.70–170.00",
        buyerAngle: "Apartment closet, laundry corner, compact room moisture",
        decision: "watch",
      },
    ],
  },
  {
    id: "compact-steamer",
    productName: "Compact Garment Steamer",
    productDirection: "Travel · Clothing care",
    targetMarkets: ["Singapore", "Malaysia"],
    heroImage: "/assets/compact-garment-steamer-pack.png",
    galleryImages: {
      main: "/assets/compact-garment-steamer-main.png",
      lifestyle: "/assets/compact-garment-steamer-lifestyle.png",
      feature: "/assets/compact-garment-steamer-feature.png",
    },
    shopeeUrl: "https://shopee.sg/search?keyword=compact%20garment%20steamer",
    sourcePrice: "USD 8.50–13.00",
    suggestedSellingPrice: "SGD 19.90–39.90",
    grossMargin: "44%",
    netProfit: "SGD 3.90",
    netMargin: "18%",
    availableStock: "In stock",
    fulfillmentTime: "14–21 days",
    marketHeat: "Medium",
    riskLevel: "Medium",
    confidenceScore: 63,
    decision: "watch",
    keyReason: "Clear wrinkle-care use case, but electrical safety, leak risk, and returns need human review.",
    runSummary:
      "The agents found an appealing travel and daily-outfit product, but the committee kept it at Watch because electronics claims, water leakage, plug type, and return handling can compress the margin.",
    evidenceLinks: [
      {
        label: "Alibaba handheld garment steamer suppliers",
        href: "https://www.alibaba.com/showroom/handheld-garment-steamer.html",
        price: "Handheld steamer supplier search",
        type: "supplier",
      },
      {
        label: "Shopee SG compact garment steamer search",
        href: "https://shopee.sg/search?keyword=compact%20garment%20steamer",
        price: "SGD 18.90–45.90 observed list band",
        type: "marketplace",
      },
      {
        label: "Shopee MY handheld garment steamer search",
        href: "https://shopee.com.my/search?keyword=handheld%20garment%20steamer",
        price: "RM 35.90–89.90 observed list band",
        type: "marketplace",
      },
    ],
    agentTimeline: [
      { agent: "Market Agent", result: "Visible demand for travel steamer and wrinkle remover searches.", status: "complete" },
      { agent: "Sourcing Agent", result: "Supplier options exist, but plug, voltage, and warranty details vary.", status: "review" },
      { agent: "Margin Agent", result: "Margin is workable only with a controlled return reserve.", status: "review" },
      { agent: "Risk Agent", result: "Medium risk from electrical safety, steam claims, and leakage complaints.", status: "review" },
      { agent: "Committee Agent", result: "WATCH until safety docs and supplier warranty are confirmed.", status: "complete" },
    ],
    regionSnapshots: [
      {
        market: "Singapore",
        priceBand: "SGD 19.90–39.90",
        buyerAngle: "Work outfits, travel packing, condo closet care",
        decision: "watch",
      },
      {
        market: "Malaysia",
        priceBand: "RM 35.90–89.90",
        buyerAngle: "Student apartments, travel, daily outfit refresh",
        decision: "watch",
      },
    ],
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

export const PACKAGING_OUTPUTS: Record<string, PackagingOutput> = {
  "mini-desk-vacuum": {
  productId: "mini-desk-vacuum",
  localizedShopeeTitle:
    "Mini Desk Vacuum Cleaner USB Rechargeable Portable Keyboard Dust Cleaner for Home Office HDB",
  titleCharCount: 92,
  sellingPoints: [
    "USB rechargeable — no battery replacement, office-friendly",
    "Compact design fits any HDB desk or student dorm",
    "Keyboard crevice nozzle — removes crumbs and dust effectively",
  ],
  productDescription:
    "Keep your desk spotless with this compact USB rechargeable mini vacuum. Perfect for keyboards, crumbs and fine dust in small home-office and student spaces.",
  positioningAngle:
    "From a single cleaning gadget into a complete desk cleaning kit for HDB home offices.",
  bundleStrategy: "Desk vacuum + cleaning brush + small storage pouch.",
  giftStrategy: "Free mini brush / replacement nozzle.",
  imagePrompts: [
    "Clean desk with mini vacuum picking up keyboard crumbs, soft daylight",
    "HDB home office desk, laptop and mini vacuum, lifestyle scene",
    "Close-up of crevice nozzle cleaning a mechanical keyboard",
  ],
  heroImageDirection: "Clean desk scene with the vacuum and keyboard crumbs.",
  lifestyleImageDirection: "HDB home office / student dorm context.",
  featureImageDirection: "Keyboard cleaning close-up with feature callouts.",
  complianceNotes: [
    "Avoid 'medical-grade' or exaggerated suction claims.",
    "State USB rechargeable clearly; no separate battery shipping.",
  ],
  priceUpliftReasoning:
    "Packaged as a desk cleaning kit, the listing supports SGD 14.90 vs SGD 8–10 for a bare tool.",
  },
  "portable-dehumidifier": {
    productId: "portable-dehumidifier",
    localizedShopeeTitle:
      "Portable Mini Dehumidifier 700ml Compact Moisture Dryer for Wardrobe Bedroom HDB Apartment",
    titleCharCount: 94,
    sellingPoints: [
      "Compact 700ml format for wardrobes, bedrooms and laundry corners",
      "Simple one-button use with visible water tank",
      "Positioned for humid Singapore and Malaysia apartment living",
    ],
    productDescription:
      "A compact mini dehumidifier for small enclosed spaces such as wardrobes, bedrooms and laundry corners. Best presented as a moisture-management helper, not a whole-room replacement.",
    positioningAngle:
      "From a generic appliance into a rainy-season wardrobe and apartment-care product.",
    bundleStrategy: "Dehumidifier + humidity card + cable organizer + care instruction card.",
    giftStrategy: "Free humidity indicator card to make the benefit visible after purchase.",
    imagePrompts: [
      "Clean cover image of compact white 700ml dehumidifier on ivory background",
      "Singapore HDB bedroom wardrobe scene with humid window and folded clothes",
      "Malaysia apartment closet / laundry corner lifestyle scene",
    ],
    heroImageDirection: "Clean product-first image with visible tank and power button.",
    lifestyleImageDirection: "Wardrobe or bedroom corner in compact humid apartment.",
    featureImageDirection: "Moisture-management callouts with no medical or mold-removal claims.",
    complianceNotes: [
      "Do not claim it can dehumidify a full large room without tested specs.",
      "Confirm plug type, warranty, voltage, and safety documentation before launch.",
      "Avoid health, anti-mold cure, or guaranteed humidity-reduction claims.",
    ],
    priceUpliftReasoning:
      "The product has marketplace demand, but the committee keeps it Watch because returns and warranty can erase a thin margin.",
  },
  "cable-organizer": {
    productId: "cable-organizer",
    localizedShopeeTitle:
      "Cable Organizer Set Desk Cable Clips Management Box Reusable Ties for Home Office Gaming Setup",
    titleCharCount: 94,
    sellingPoints: [
      "Complete desk cable kit with clips, ties, and management box",
      "No-tool setup for WFH desks, student rooms, and gaming tables",
      "Lightweight bundle ships cheaply and lifts perceived value",
    ],
    productDescription:
      "Keep your desk clean with a compact cable organizer set for chargers, laptop cables, power strips, and gaming setups. Designed for simple daily cable management.",
    positioningAngle:
      "From cheap cable clips into a tidy desk upgrade kit for home office and study setups.",
    bundleStrategy: "Cable box + cable clips + reusable ties + desk setup card.",
    giftStrategy: "Free mini velcro tie pack to make the kit feel complete.",
    imagePrompts: [
      "Clean product cover showing cable clips, cable box and reusable ties on ivory background",
      "Singapore HDB home office desk with organized cables under the table",
      "Malaysia student gaming desk with clean cable routing and callouts",
    ],
    heroImageDirection: "Product-first kit layout showing every included organizer piece.",
    lifestyleImageDirection: "Under-desk home office setup with clean routed cables.",
    featureImageDirection: "Gaming desk cable cleanup with clear before-and-after value.",
    complianceNotes: [
      "Avoid guaranteed no-residue claims unless adhesive specs are confirmed.",
      "State included quantities clearly to prevent bundle disputes.",
    ],
    priceUpliftReasoning:
      "Bundling clips, ties and a cable box supports SGD 8.90–10.90 pricing versus single-piece commodity clips.",
  },
  "pet-grooming-tool": {
    productId: "pet-grooming-tool",
    localizedShopeeTitle:
      "Pet Grooming Brush Self Cleaning Cat Dog Hair Remover Gentle Comb for Small Dogs and Cats",
    titleCharCount: 92,
    sellingPoints: [
      "Self-cleaning brush design makes loose fur removal easier",
      "Gentle daily-care positioning for cats and small dogs",
      "Strong HDB living angle: less loose fur on sofa and bedding",
    ],
    productDescription:
      "A gentle self-cleaning grooming brush for cats and small dogs. Helps remove loose fur during daily grooming and keeps home surfaces easier to maintain.",
    positioningAngle:
      "From a generic pet brush into a gentle HDB home-care tool for less visible loose fur.",
    bundleStrategy: "Grooming brush + silicone bath brush + storage pouch.",
    giftStrategy: "Free mini lint roller sheet pack for sofa and clothing cleanup.",
    imagePrompts: [
      "Clean cover image of white pet grooming brush with soft orange callouts",
      "Cat grooming scene in bright HDB living room with less fur around home",
      "Small dog grooming lifestyle scene with gentle daily care positioning",
    ],
    heroImageDirection: "Product-first brush image with gentle pin and one-click cleaning callouts.",
    lifestyleImageDirection: "Cat or small dog grooming in a bright apartment living room.",
    featureImageDirection: "Daily grooming, comfort grip and self-cleaning button details.",
    complianceNotes: [
      "Avoid medical, allergy, or skin-treatment claims.",
      "Use gentle language and mention suitability for cats and small dogs only.",
    ],
    priceUpliftReasoning:
      "The care bundle and pet-home narrative support SGD 12.90 pricing instead of a plain brush listing.",
  },
  "compact-steamer": {
    productId: "compact-steamer",
    localizedShopeeTitle:
      "Compact Garment Steamer Handheld Foldable Clothes Steam Iron for Travel Home Office",
    titleCharCount: 84,
    sellingPoints: [
      "Compact handheld format for daily outfits and travel packing",
      "Clear wardrobe and business-trip use case for SG/MY buyers",
      "Human-review item: plug, voltage, leak and warranty must be confirmed",
    ],
    productDescription:
      "A compact handheld garment steamer for quick outfit refreshes at home or while travelling. Best kept as a Watch item until electrical safety, plug type and warranty details are confirmed.",
    positioningAngle:
      "From generic electronics into a quick outfit-care tool for workwear, travel and student living.",
    bundleStrategy: "Steamer + travel pouch + refill cup + quick-care instruction card.",
    giftStrategy: "Free travel pouch to improve perceived portability.",
    imagePrompts: [
      "Clean compact garment steamer cover image with visible tank and steam head",
      "Singapore condo closet scene with shirt steaming before work",
      "Malaysia travel apartment scene with handheld steamer near suitcase",
    ],
    heroImageDirection: "Product-first image with visible water tank and steam head.",
    lifestyleImageDirection: "Closet or travel packing scene showing wrinkle-care use.",
    featureImageDirection: "Lightweight, refill, travel-ready and leak-risk review callouts.",
    complianceNotes: [
      "Confirm voltage, plug, safety certification and warranty before launch.",
      "Avoid guaranteed wrinkle-removal timing unless supplier specs are tested.",
      "Do not hide electronics return and leakage risk from the committee view.",
    ],
    priceUpliftReasoning:
      "The travel pouch and outfit-care framing help pricing, but returns and warranty keep the committee decision at Watch.",
  },
};

export const PACKAGING_OUTPUT = PACKAGING_OUTPUTS["mini-desk-vacuum"];

export const LISTINGS: Record<string, ShopeeListing> = {
  "mini-desk-vacuum": {
  productId: "mini-desk-vacuum",
  fields: [
    {
      key: "item_name",
      value:
        "Mini Desk Vacuum Cleaner USB Rechargeable Portable Keyboard Dust Cleaner for Home Office HDB",
      editable: true,
    },
    { key: "price", value: "SGD 14.90", editable: true },
    { key: "stock", value: "100", editable: true },
    { key: "category", value: "Home Appliances › Vacuum Cleaners", editable: false },
    { key: "brand", value: "No Brand", editable: true },
    { key: "condition", value: "New", editable: false },
    {
      key: "description",
      value:
        "Keep your desk spotless with this compact USB rechargeable mini vacuum. Ideal for keyboards, crumbs and fine dust.",
      editable: true,
    },
    { key: "sku", value: "SL-MDV-001", editable: true },
    { key: "variation", value: "White / Pink", editable: true },
    { key: "package_weight", value: "0.35 kg", editable: true },
    { key: "package_dimensions", value: "18 × 8 × 8 cm", editable: true },
  ],
  preview: {
    image: "/assets/mini-desk-vacuum-main.png",
    title:
      "Mini Desk Vacuum Cleaner USB Rechargeable Portable Keyboard Dust Cleaner",
    price: "SGD 14.90",
    bullets: [
      "USB rechargeable, no battery needed",
      "Compact for HDB desk and student dorm",
      "Keyboard crevice nozzle included",
    ],
  },
  },
  "portable-dehumidifier": {
    productId: "portable-dehumidifier",
    fields: [
      {
        key: "item_name",
        value:
          "Portable Mini Dehumidifier 700ml Compact Moisture Dryer for Wardrobe Bedroom HDB Apartment",
        editable: true,
      },
      { key: "price", value: "SGD 39.90", editable: true },
      { key: "stock", value: "60", editable: true },
      { key: "category", value: "Home Appliances › Dehumidifiers", editable: false },
      { key: "brand", value: "No Brand", editable: true },
      { key: "condition", value: "New", editable: false },
      {
        key: "description",
        value:
          "Compact dehumidifier for wardrobes, bedrooms and laundry corners. Suitable for small enclosed spaces in humid city living.",
        editable: true,
      },
      { key: "sku", value: "SL-PDH-002", editable: true },
      { key: "variation", value: "White / 700ml", editable: true },
      { key: "package_weight", value: "1.1 kg", editable: true },
      { key: "package_dimensions", value: "25 x 16 x 14 cm", editable: true },
    ],
    preview: {
      image: "/assets/portable-dehumidifier-main.png",
      title:
        "Portable Mini Dehumidifier 700ml Compact Moisture Dryer for Wardrobe",
      price: "SGD 39.90",
      bullets: [
        "Compact for wardrobe and bedroom corners",
        "Visible water tank, one-button operation",
        "Great for humid apartment living",
      ],
    },
  },
  "cable-organizer": {
    productId: "cable-organizer",
    fields: [
      {
        key: "item_name",
        value:
          "Cable Organizer Set Desk Cable Clips Management Box Reusable Ties for Home Office Gaming Setup",
        editable: true,
      },
      { key: "price", value: "SGD 8.90", editable: true },
      { key: "stock", value: "150", editable: true },
      { key: "category", value: "Home & Living › Home Organizers", editable: false },
      { key: "brand", value: "No Brand", editable: true },
      { key: "condition", value: "New", editable: false },
      {
        key: "description",
        value:
          "A complete desk cable organizer set with clips, reusable ties and cable management box. Great for WFH desks, student rooms and gaming setups.",
        editable: true,
      },
      { key: "sku", value: "SL-COS-003", editable: true },
      { key: "variation", value: "White / Black Kit", editable: true },
      { key: "package_weight", value: "0.28 kg", editable: true },
      { key: "package_dimensions", value: "22 x 10 x 6 cm", editable: true },
    ],
    preview: {
      image: "/assets/cable-organizer-main.png",
      title:
        "Cable Organizer Set Desk Cable Clips Management Box Reusable Ties",
      price: "SGD 8.90",
      bullets: [
        "Complete clips, ties and cable box kit",
        "No-tool setup for desk and gaming spaces",
        "Keeps charger and power cables tidy",
      ],
    },
  },
  "pet-grooming-tool": {
    productId: "pet-grooming-tool",
    fields: [
      {
        key: "item_name",
        value:
          "Pet Grooming Brush Self Cleaning Cat Dog Hair Remover Gentle Comb for Small Dogs and Cats",
        editable: true,
      },
      { key: "price", value: "SGD 12.90", editable: true },
      { key: "stock", value: "120", editable: true },
      { key: "category", value: "Pet Supplies › Grooming Supplies", editable: false },
      { key: "brand", value: "No Brand", editable: true },
      { key: "condition", value: "New", editable: false },
      {
        key: "description",
        value:
          "Gentle self-cleaning grooming brush for cats and small dogs. Helps remove loose fur during daily grooming and keeps home surfaces easier to maintain.",
        editable: true,
      },
      { key: "sku", value: "SL-PGT-004", editable: true },
      { key: "variation", value: "White Brush / Brush + Bath Pad", editable: true },
      { key: "package_weight", value: "0.22 kg", editable: true },
      { key: "package_dimensions", value: "20 x 9 x 6 cm", editable: true },
    ],
    preview: {
      image: "/assets/pet-grooming-tool-main.png",
      title:
        "Pet Grooming Brush Self Cleaning Cat Dog Hair Remover Gentle Comb",
      price: "SGD 12.90",
      bullets: [
        "Self-cleaning button for loose fur removal",
        "Gentle pins for cats and small dogs",
        "Daily care for sofa and HDB living",
      ],
    },
  },
  "compact-steamer": {
    productId: "compact-steamer",
    fields: [
      {
        key: "item_name",
        value:
          "Compact Garment Steamer Handheld Foldable Clothes Steam Iron for Travel Home Office",
        editable: true,
      },
      { key: "price", value: "SGD 29.90", editable: true },
      { key: "stock", value: "45", editable: true },
      { key: "category", value: "Home Appliances › Garment Steamers", editable: false },
      { key: "brand", value: "No Brand", editable: true },
      { key: "condition", value: "New", editable: false },
      {
        key: "description",
        value:
          "Compact handheld garment steamer for quick outfit refreshes at home or while travelling. Plug type, voltage and warranty to be confirmed before launch.",
        editable: true,
      },
      { key: "sku", value: "SL-CGS-005", editable: true },
      { key: "variation", value: "White / Travel Pouch Bundle", editable: true },
      { key: "package_weight", value: "0.85 kg", editable: true },
      { key: "package_dimensions", value: "28 x 13 x 12 cm", editable: true },
    ],
    preview: {
      image: "/assets/compact-garment-steamer-main.png",
      title:
        "Compact Garment Steamer Handheld Foldable Clothes Steam Iron",
      price: "SGD 29.90",
      bullets: [
        "Compact for travel and daily outfits",
        "Visible tank and easy refill positioning",
        "Human review needed for plug and warranty",
      ],
    },
  },
};

export const LISTING = LISTINGS["mini-desk-vacuum"];

export function packagingFor(productId: string): PackagingOutput {
  return PACKAGING_OUTPUTS[productId] ?? PACKAGING_OUTPUT;
}

export function listingFor(productId: string): ShopeeListing {
  return LISTINGS[productId] ?? LISTING;
}

export const HOMEPAGE_STATS = [
  { value: 5, suffix: " products", label: "validated per run", sub: "market · margin · risk" },
  { prefix: "SGD ", value: 14.9, decimals: 2, label: "avg suggested price", sub: "from SGD 3.80 cost" },
  { value: 31, suffix: "%", label: "net margin after", sub: "fees · shipping · returns" },
  { value: 11, suffix: " min", label: "brief to Shopee-ready", sub: "launch pack" },
];

export const BOARD_SUMMARY = {
  found: OPPORTUNITIES.length,
  go: OPPORTUNITIES.filter((o) => o.decision === "go").length,
  watch: OPPORTUNITIES.filter((o) => o.decision === "watch").length,
  reject: OPPORTUNITIES.filter((o) => o.decision === "reject").length,
  avgMargin: "28%",
  riskFlags: 1,
};
