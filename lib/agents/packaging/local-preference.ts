import type { Evidence, SelectedListing } from "../../../contract/result";
import { UNSUPPORTED_PRODUCT_CLAIMS } from "../../compliance/claims";
import type {
  CopyPattern,
  GroundedProductFacts,
  ImagePattern,
  LocalPreferenceProfile,
  PackagingInput,
  PreferenceEvidenceItem,
  TitlePattern,
} from "./schema";

const FEATURE_SIGNAL_TERMS = [
  "usb",
  "cordless",
  "lightweight",
  "180",
  "keyboard",
  "desk",
  "crumb",
  "dust",
  "container",
  "portable",
  "rechargeable",
];

const INTERNAL_SPEC_KEY_PATTERNS = [
  /(^|_)cost($|_)/i,
  /(^|_)margin($|_)/i,
  /(^|_)profit($|_)/i,
  /^source($|_)/i,
  /(^|_)supplier($|_)/i,
  /(^|_)fulfillment($|_)/i,
  /(^|_)delivery($|_)/i,
  /(^|_)price($|_)/i,
  /(^|_)moq($|_)/i,
  /(^|_)stock($|_)/i,
];

export interface CompetitorStyleExtraction {
  evidence_items: PreferenceEvidenceItem[];
  visual_style: string[];
  local_scene_cues: string[];
  preferred_terms: string[];
  title_pattern: TitlePattern;
  copy_pattern: CopyPattern;
  image_pattern: Pick<ImagePattern, "hero" | "lifestyle">;
  confidence_signals: string[];
}

export interface ProductFactExtraction {
  evidence_items: PreferenceEvidenceItem[];
  grounded_product_facts: Omit<GroundedProductFacts, "banned_claims">;
  feature_callouts: string[];
}

export interface PolicyConstraintExtraction {
  evidence_items: PreferenceEvidenceItem[];
  banned_claims: string[];
  compliance_notes: string[];
}

// This is the Packaging Agent's local-preference research subagent. It stays
// deterministic for the MVP, but its decisions are built from explicit tool
// outputs instead of agent memory or hardcoded market taste.
export function runLocalPreferenceResearchSubagent(input: PackagingInput): LocalPreferenceProfile {
  const competitorStyle = extractCompetitorStyle(input);
  const productFacts = extractProductFacts(input);
  const policyConstraints = extractPolicyConstraints(input);
  const evidenceItems = uniqueEvidenceItems([
    ...competitorStyle.evidence_items,
    ...productFacts.evidence_items,
    ...policyConstraints.evidence_items,
  ]);
  const bannedClaims = uniqueList([
    ...policyConstraints.banned_claims,
    ...productFacts.grounded_product_facts.uncertain_or_missing,
  ]);
  const allowedFeatureCallouts = productFacts.feature_callouts.filter((claim) => !containsAny(claim, bannedClaims));
  const needsHumanReview =
    competitorStyle.evidence_items.length < 2 ||
    input.competitor_signals.length === 0 ||
    productFacts.grounded_product_facts.uncertain_or_missing.length > 0 ||
    policyConstraints.compliance_notes.length > 0;

  const imagePattern: ImagePattern = {
    hero: competitorStyle.image_pattern.hero,
    lifestyle: competitorStyle.image_pattern.lifestyle,
    feature: {
      allowed_callouts: allowedFeatureCallouts,
      needs_review_reasons: uniqueList([
        ...productFacts.grounded_product_facts.uncertain_or_missing.map((claim) => `Missing proof for ${claim}`),
        ...policyConstraints.compliance_notes,
      ]),
    },
  };
  const copyPattern: CopyPattern = {
    ...competitorStyle.copy_pattern,
    compliance_notes: uniqueList([...competitorStyle.copy_pattern.compliance_notes, ...policyConstraints.compliance_notes]),
  };
  const groundedFacts: GroundedProductFacts = {
    ...productFacts.grounded_product_facts,
    banned_claims: bannedClaims,
  };

  return {
    market: input.brief.target_market,
    platform: input.brief.target_platform,
    category: input.brief.category,
    evidence_items: evidenceItems,
    grounded_product_facts: groundedFacts,
    title_pattern: {
      ...competitorStyle.title_pattern,
      avoid_terms: bannedClaims,
    },
    copy_pattern: copyPattern,
    image_pattern: imagePattern,
    copy_style: [
      competitorStyle.copy_pattern.tone,
      `Bullet order: ${competitorStyle.copy_pattern.bullet_order.join(" > ")}`,
      ...copyPattern.compliance_notes,
    ],
    visual_style: competitorStyle.visual_style,
    local_scene_cues: competitorStyle.local_scene_cues,
    preferred_terms: uniqueList([...competitorStyle.preferred_terms, ...allowedFeatureCallouts]),
    avoid_terms: bannedClaims,
    evidence: buildPreferenceEvidence(input, evidenceItems, competitorStyle, productFacts, policyConstraints),
    confidence: confidenceFor(input, competitorStyle, productFacts, policyConstraints, needsHumanReview),
    needs_human_review: needsHumanReview,
  };
}

export function extractCompetitorStyle(input: PackagingInput): CompetitorStyleExtraction {
  const listing = input.selected_listing;
  const evidenceItems: PreferenceEvidenceItem[] = [];
  const visualStyle: string[] = [];
  const localSceneCues: string[] = [];
  const preferredTerms: string[] = [];
  const titleTerms: string[] = [];
  const buyerUseCases: string[] = [];
  const competitorEvidenceIds: string[] = [];

  for (const [signalIndex, signal] of input.competitor_signals.entries()) {
    if (signal.title?.trim()) {
      const evidence = createEvidenceItem(
        "competitor",
        signal.source,
        signal.title,
        signal.evidence_label ?? `Competitor title ${signalIndex + 1}`,
      );
      evidenceItems.push(evidence);
      competitorEvidenceIds.push(evidence.id);
      titleTerms.push(...extractTitleTerms(signal.title));
      preferredTerms.push(...extractTitleTerms(signal.title));
      buyerUseCases.push(...extractBuyerUseCases(signal.title));
    }

    for (const [noteIndex, note] of signal.style_notes.entries()) {
      if (!note.trim()) {
        continue;
      }
      const evidence = createEvidenceItem(
        "style",
        signal.source,
        note,
        `${signal.evidence_label ?? `Competitor ${signalIndex + 1}`} style note ${noteIndex + 1}`,
      );
      evidenceItems.push(evidence);
      competitorEvidenceIds.push(evidence.id);
      visualStyle.push(note);
      localSceneCues.push(...extractLocalSceneCues(note));
      buyerUseCases.push(...extractBuyerUseCases(note));
    }
  }

  const listingFacts = extractListingFactEvidence(listing);
  for (const fact of listingFacts) {
    preferredTerms.push(fact.quote_or_fact);
    localSceneCues.push(...extractLocalSceneCues(fact.quote_or_fact));
    buyerUseCases.push(...extractBuyerUseCases(fact.quote_or_fact));
  }

  const uniqueVisualStyle = uniqueList(visualStyle);
  const uniqueLocalSceneCues = uniqueList(localSceneCues);
  const fallbackEvidence = evidenceItems[0]?.id ?? listingFacts[0]?.id ?? "no_preference_evidence";

  return {
    evidence_items: evidenceItems,
    visual_style: uniqueVisualStyle.length ? uniqueVisualStyle.slice(0, 6) : ["No competitor visual style evidence supplied"],
    local_scene_cues: uniqueLocalSceneCues.slice(0, 6),
    preferred_terms: uniqueList(preferredTerms).slice(0, 10),
    title_pattern: {
      formula: titleFormulaFor(titleTerms),
      must_include_terms: uniqueList(titleTerms).slice(0, 5),
      avoid_terms: [],
      rationale_evidence_ids: uniqueList(competitorEvidenceIds.length ? competitorEvidenceIds : [fallbackEvidence]).slice(0, 6),
    },
    copy_pattern: {
      tone: toneFor(uniqueVisualStyle, input),
      buyer_use_cases: uniqueList(buyerUseCases).slice(0, 5),
      bullet_order: bulletOrderFor(input, buyerUseCases),
      compliance_notes: input.competitor_signals.length
        ? []
        : ["No competitor style evidence supplied; keep localization conservative and request review."],
    },
    image_pattern: {
      hero: heroPatternFor(uniqueVisualStyle),
      lifestyle: lifestylePatternFor(uniqueLocalSceneCues, buyerUseCases, input),
    },
    confidence_signals: uniqueList([
      input.competitor_signals.length ? `${input.competitor_signals.length} competitor listings inspected` : "",
      uniqueVisualStyle.length ? "competitor visual style extracted" : "",
      uniqueLocalSceneCues.length ? "local scene cues found in evidence" : "",
    ]),
  };
}

export function extractProductFacts(input: PackagingInput): ProductFactExtraction {
  const listing = input.selected_listing.shopee;
  const publicProductSpecs = Object.entries(input.product_specs).filter(([key, value]) => isBuyerSafeProductSpec(key, value));
  const evidenceItems = uniqueEvidenceItems([
    createEvidenceItem("product", "listing.item_name", listing.item_name, "Listing title"),
    ...listing.bullet_points.map((point, index) =>
      createEvidenceItem("product", `listing.bullet_points.${index}`, point, `Listing bullet ${index + 1}`),
    ),
    ...publicProductSpecs.map(([key, value]) =>
      createEvidenceItem("product", `product_specs.${key}`, `${key}: ${String(value)}`, `Product spec ${key}`),
    ),
  ]);
  const allowedClaims = uniqueList(evidenceItems.map((item) => item.quote_or_fact))
    .filter((claim) => !containsAny(claim, UNSUPPORTED_PRODUCT_CLAIMS))
    .slice(0, 16);
  const allowedText = normalize(allowedClaims.join(" "));
  const uncertainOrMissing = UNSUPPORTED_PRODUCT_CLAIMS.filter((claim) => !includesTerm(allowedText, claim)).filter((claim) =>
    shouldTrackMissingClaim(input, claim),
  );
  const featureCallouts = allowedClaims
    .filter((claim) => FEATURE_SIGNAL_TERMS.some((term) => includesTerm(normalize(claim), term)))
    .slice(0, 6);

  return {
    evidence_items: evidenceItems,
    grounded_product_facts: {
      allowed_claims: allowedClaims,
      uncertain_or_missing: uniqueList(uncertainOrMissing),
    },
    feature_callouts: featureCallouts,
  };
}

export function extractPolicyConstraints(input: PackagingInput): PolicyConstraintExtraction {
  const values = [...input.policy_rules, ...input.risk_warnings];
  const evidenceItems = uniqueEvidenceItems(
    values.map((value, index) =>
      createEvidenceItem(
        index < input.policy_rules.length ? "policy" : "risk",
        index < input.policy_rules.length ? `policy_rules.${index}` : `risk_warnings.${index - input.policy_rules.length}`,
        value,
        index < input.policy_rules.length ? `Policy rule ${index + 1}` : `Risk warning ${index - input.policy_rules.length + 1}`,
      ),
    ),
  );
  const sourceText = normalize(values.join(" "));
  const explicitBannedClaims = UNSUPPORTED_PRODUCT_CLAIMS.filter((claim) => includesTerm(sourceText, claim));
  const listingText = normalize(selectedListingText(input.selected_listing));
  const safetyBannedClaims = UNSUPPORTED_PRODUCT_CLAIMS.filter((claim) => includesTerm(listingText, claim));
  const missingSafetyProofClaims = UNSUPPORTED_PRODUCT_CLAIMS.filter((claim) => shouldTrackMissingClaim(input, claim));
  const bannedClaims = uniqueList([...explicitBannedClaims, ...safetyBannedClaims, ...missingSafetyProofClaims]);

  return {
    evidence_items: evidenceItems,
    banned_claims: bannedClaims,
    compliance_notes: uniqueList([
      ...explicitBannedClaims.map((claim) => `Policy/risk evidence disallows "${claim}" claim.`),
      ...safetyBannedClaims.map((claim) => `Listing text contains "${claim}" and must be sanitized unless proven.`),
      ...missingSafetyProofClaims.map((claim) => `No product proof for sensitive claim "${claim}".`),
    ]),
  };
}

export function selectedListingText(listing: SelectedListing): string {
  return [
    listing.market,
    listing.shopee.item_name,
    listing.shopee.description,
    ...listing.shopee.bullet_points,
    ...Object.values(listing.shopee.attributes),
  ]
    .filter(Boolean)
    .join(" ");
}

function extractListingFactEvidence(listing: SelectedListing): PreferenceEvidenceItem[] {
  return [
    createEvidenceItem("listing", "listing.market", listing.market, "Listing market"),
    createEvidenceItem("listing", "listing.item_name", listing.shopee.item_name, "Listing item name"),
    ...listing.shopee.bullet_points.map((point, index) =>
      createEvidenceItem("listing", `listing.bullet_points.${index}`, point, `Listing bullet ${index + 1}`),
    ),
  ];
}

function buildPreferenceEvidence(
  input: PackagingInput,
  evidenceItems: PreferenceEvidenceItem[],
  competitorStyle: CompetitorStyleExtraction,
  productFacts: ProductFactExtraction,
  policyConstraints: PolicyConstraintExtraction,
): Evidence[] {
  return [
    {
      label: "Preference research tools",
      value: [
        `competitor_style_extractor=${competitorStyle.evidence_items.length} evidence items`,
        `product_fact_extractor=${productFacts.evidence_items.length} product facts`,
        `policy_constraint_extractor=${policyConstraints.evidence_items.length} rules/warnings`,
      ].join("; "),
    },
    {
      label: "Preference evidence ids",
      value: evidenceItems.map((item) => `${item.id}:${item.source}`).slice(0, 8).join("; "),
    },
    {
      label: "Competitor style",
      value: competitorStyle.visual_style.join("; "),
    },
    {
      label: "Local scene cues",
      value: competitorStyle.local_scene_cues.length
        ? competitorStyle.local_scene_cues.join("; ")
        : "No local scene cue found in competitor/listing evidence",
    },
    {
      label: "Risk constraints applied",
      value: input.risk_warnings.length ? input.risk_warnings.join("; ") : "No risk warnings supplied",
    },
  ];
}

function confidenceFor(
  input: PackagingInput,
  competitorStyle: CompetitorStyleExtraction,
  productFacts: ProductFactExtraction,
  policyConstraints: PolicyConstraintExtraction,
  needsHumanReview: boolean,
): number {
  let confidence = 0.35;
  if (input.competitor_signals.length) {
    confidence += 0.15;
  }
  if (competitorStyle.evidence_items.length >= 2) {
    confidence += 0.15;
  }
  if (competitorStyle.local_scene_cues.length) {
    confidence += 0.1;
  }
  if (productFacts.grounded_product_facts.allowed_claims.length >= 4) {
    confidence += 0.15;
  }
  if (input.policy_rules.length || input.risk_warnings.length) {
    confidence += 0.1;
  }
  if (policyConstraints.banned_claims.length) {
    confidence += 0.05;
  }
  if (needsHumanReview) {
    confidence -= 0.1;
  }
  return Math.max(0.2, Math.min(0.88, Number(confidence.toFixed(2))));
}

function titleFormulaFor(titleTerms: string[]): string {
  const terms = uniqueList(titleTerms);
  if (terms.some((term) => includesTerm(normalize(term), "keyboard")) || terms.some((term) => includesTerm(normalize(term), "desk"))) {
    return "Product type + power/use-case term + desk/keyboard context + safe differentiator";
  }
  if (terms.length) {
    return "Product type + strongest evidenced use case + safe differentiator";
  }
  return "Product type + evidenced specs only";
}

function bulletOrderFor(input: PackagingInput, buyerUseCases: string[]): string[] {
  const order = ["product type", "evidenced specs"];
  if (buyerUseCases.length) {
    order.push("buyer use case");
  }
  if (input.opportunity?.fulfillment_days) {
    order.push("fulfillment note");
  }
  order.push("usage limits");
  return order;
}

function heroPatternFor(visualStyle: string[]): ImagePattern["hero"] {
  const visualText = normalize(visualStyle.join(" "));
  if (!visualStyle.length) {
    return {
      composition: "product-centered marketplace hero pending competitor style evidence",
      background: "plain ecommerce background; no local decorative trope without evidence",
      text_overlay: false,
    };
  }

  return {
    composition: visualText.includes("white") ? "product-forward marketplace hero" : "product-centered marketplace hero",
    background: visualText.includes("pastel")
      ? "soft clean desk background derived from competitor style evidence"
      : "clean neutral desk background derived from competitor style evidence",
    text_overlay: false,
  };
}

function lifestylePatternFor(
  localSceneCues: string[],
  buyerUseCases: string[],
  input: PackagingInput,
): ImagePattern["lifestyle"] {
  return {
    scene: localSceneCues.length
      ? `small-space ${localSceneCues.slice(0, 3).join(" / ")} scene`
      : `${input.brief.target_market} ${input.brief.category} scene pending competitor evidence`,
    props: uniqueList(buyerUseCases).slice(0, 5),
    local_context: localSceneCues.slice(0, 5),
  };
}

function toneFor(visualStyle: string[], input: PackagingInput): CopyPattern["tone"] {
  const text = normalize(`${visualStyle.join(" ")} ${selectedListingText(input.selected_listing)}`);
  if (text.includes("cute") || text.includes("pastel")) {
    return "cute-functional";
  }
  if (text.includes("friendly")) {
    return "friendly";
  }
  return "factual";
}

function extractTitleTerms(value: string): string[] {
  const text = normalize(value);
  const terms: string[] = [];
  for (const term of FEATURE_SIGNAL_TERMS) {
    if (includesTerm(text, term)) {
      terms.push(term);
    }
  }
  if (includesTerm(text, "mini")) {
    terms.push("mini");
  }
  if (includesTerm(text, "vacuum")) {
    terms.push("vacuum");
  }
  return terms;
}

function extractLocalSceneCues(value: string): string[] {
  const originalTokens = value
    .replace(/[^A-Za-z0-9&\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const normalizedTokens = originalTokens.map(normalize);
  const cues: string[] = [];

  for (let index = 0; index < originalTokens.length; index += 1) {
    const token = originalTokens[index];
    if (/^[A-Z0-9]{2,5}$/.test(token)) {
      cues.push(uniqueList(originalTokens.slice(index, index + 3)).join(" "));
      continue;
    }

    if (isContextAnchor(normalizedTokens[index])) {
      const start = Math.max(0, index - 1);
      const end = Math.min(originalTokens.length, index + 3);
      cues.push(originalTokens.slice(start, end).join(" "));
    }
  }

  return uniqueList(cues.map(cleanCue)).filter((cue) => cue.length >= 3).slice(0, 6);
}

function extractBuyerUseCases(value: string): string[] {
  const text = normalize(value);
  const cases: string[] = [];
  if (includesTerm(text, "keyboard")) {
    cases.push(includesTerm(text, "crumb") ? "keyboard crumbs" : "keyboard cleaning");
  }
  if (includesTerm(text, "desk")) {
    cases.push(includesTerm(text, "dust") ? "desk dust" : "desk cleanup");
  }
  cases.push(...extractLocalSceneCues(value).map((cue) => `${cue} cleanup`));
  return cases;
}

function isContextAnchor(value: string): boolean {
  return [
    "home",
    "homes",
    "office",
    "offices",
    "dorm",
    "dorms",
    "desk",
    "desks",
    "keyboard",
    "keyboards",
    "apartment",
    "apartments",
    "condo",
    "condos",
    "room",
    "rooms",
    "living",
    "spaces",
  ].includes(value);
}

function cleanCue(value: string): string {
  return value.replace(/\s+/g, " ").replace(/\s*&\s*/g, " & ").trim();
}

function shouldTrackMissingClaim(input: PackagingInput, claim: string): boolean {
  const text = normalize([
    input.selected_listing.shopee.item_name,
    input.selected_listing.shopee.description,
    ...input.selected_listing.shopee.bullet_points,
    ...Object.values(input.product_specs).map(String),
    ...input.risk_warnings,
    ...input.policy_rules,
  ].join(" "));
  return includesTerm(text, claim);
}

function isBuyerSafeProductSpec(key: string, value: string | number | boolean): boolean {
  if (value === "" || value === false || value === null || value === undefined) {
    return false;
  }
  return !INTERNAL_SPEC_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function createEvidenceItem(kind: string, source: string, quoteOrFact: string, label: string): PreferenceEvidenceItem {
  return {
    id: `pref_${kind}_${hashStable(`${source}:${quoteOrFact}`)}`,
    source: `${source} · ${label}`,
    quote_or_fact: quoteOrFact.trim(),
  };
}

function uniqueEvidenceItems(items: PreferenceEvidenceItem[]): PreferenceEvidenceItem[] {
  const seen = new Set<string>();
  const result: PreferenceEvidenceItem[] = [];

  for (const item of items.filter((candidate) => candidate.quote_or_fact.trim())) {
    if (!seen.has(item.id)) {
      seen.add(item.id);
      result.push(item);
    }
  }
  return result;
}

function containsAny(value: string, terms: string[]): boolean {
  return terms.some((term) => includesTerm(normalize(value), term));
}

function includesTerm(normalizedText: string, term: string): boolean {
  const normalizedTerm = normalize(term);
  if (/^[a-z0-9]{2,3}$/.test(normalizedTerm)) {
    return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "i").test(normalizedText);
  }
  return normalizedText.includes(normalizedTerm);
}

function normalize(value: string): string {
  return value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

function uniqueList(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values.map((item) => item.trim()).filter(Boolean)) {
    const key = normalize(value);
    if (!seen.has(key)) {
      seen.add(key);
      result.push(value);
    }
  }

  return result;
}

function hashStable(value: string): string {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
