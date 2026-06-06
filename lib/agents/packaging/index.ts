import type { AgentResult, Evidence, ListingImage, Opportunity, RunResult, SelectedListing } from "../../../contract/result";
import { validateJsonSchema } from "../../agent-runtime/schemas";
import type { AgentContext, RiskCheckpoint } from "../contracts";
import { runLocalPreferenceResearchSubagent, selectedListingText } from "./local-preference";
import { packagingSkill } from "./skill";
import {
  maxComplianceStatus,
  packagingOutputSchema,
  type CompetitorStyleSignal,
  type LocalPreferenceProfile,
  type PackagingImageMode,
  type PackagingImageResult,
  type PackagingInput,
  type PackagingOutput,
  type PackagingPrompt,
} from "./schema";

export interface RunPackagingAgentOptions {
  runId?: string;
  imageMode?: PackagingImageMode;
  sourceImage?: string;
  competitorSignals?: CompetitorStyleSignal[];
  productSpecs?: Record<string, string | number | boolean>;
  policyRules?: string[];
  riskWarnings?: string[];
}

const ASSET_TYPES = ["hero", "lifestyle", "feature"] as const;

export async function runPackagingAgent(
  ctx: AgentContext,
  options: RunPackagingAgentOptions = {},
): Promise<Partial<RunResult>> {
  const input = await buildPackagingInput(ctx, options);
  const output = await runPackaging(input, ctx);
  const selectedListing = applyPackagingOutput(input.selected_listing, output);

  return {
    agents: [output.agent],
    selected_listing: selectedListing,
  };
}

export async function runPackaging(input: PackagingInput, ctx: Pick<AgentContext, "providers" | "risk">): Promise<PackagingOutput> {
  const preferenceProfile = runLocalPreferenceResearchSubagent(input);
  const prompts = buildImagePrompts(input, preferenceProfile);
  const sellingCopy = buildSellingCopy(input, preferenceProfile);
  const images =
    input.mode === "dry-run"
      ? await buildDryRunImages(input, prompts, ctx)
      : await buildLiveImages(input, prompts, ctx);
  const checkpoint = await ctx.risk.checkpoint("packaging", {
    preference_profile: preferenceProfile,
    prompts,
    images,
    product_specs: input.product_specs,
    policy_rules: input.policy_rules,
    risk_warnings: input.risk_warnings,
  });
  const compliance = buildCompliance(input, images, checkpoint);
  const agent = buildAgentResult(input, preferenceProfile, images, compliance.warnings, checkpoint);
  const output: PackagingOutput = {
    preference_profile: preferenceProfile,
    selling_copy: sellingCopy,
    prompts,
    images,
    compliance,
    agent,
  };
  const validation = validateJsonSchema(packagingOutputSchema, output);

  if (!validation.valid) {
    throw new Error(`Packaging output failed schema validation: ${validation.errors.join("; ")}`);
  }

  return output;
}

export async function buildPackagingInput(
  ctx: AgentContext,
  options: RunPackagingAgentOptions = {},
): Promise<PackagingInput> {
  const selectedListing = ctx.results.selected_listing;
  if (!selectedListing) {
    throw new Error("Packaging Agent requires ctx.results.selected_listing from the Listing Agent.");
  }

  const [competitorSignals, policyRules] = await Promise.all([
    options.competitorSignals ? Promise.resolve(options.competitorSignals) : collectCompetitorSignals(ctx),
    options.policyRules ? Promise.resolve(options.policyRules) : collectPolicyRules(ctx),
  ]);
  const opportunity = ctx.results.opportunities?.find((candidate) => candidate.id === selectedListing.opportunity_id);

  return {
    run_id: options.runId ?? ctx.results.run_id ?? "run_packaging_preview",
    mode: options.imageMode ?? readImageMode(),
    brief: ctx.brief,
    selected_listing: selectedListing,
    opportunity,
    competitor_signals: competitorSignals,
    product_specs: options.productSpecs ?? collectProductSpecs(selectedListing, opportunity),
    policy_rules: policyRules,
    risk_warnings: options.riskWarnings ?? collectRiskWarnings(ctx, selectedListing),
    source_image: options.sourceImage,
  };
}

function applyPackagingOutput(listing: SelectedListing, output: PackagingOutput): SelectedListing {
  return {
    ...listing,
    shopee: {
      ...listing.shopee,
      item_name: output.selling_copy.item_name,
      description: output.selling_copy.description,
      bullet_points: output.selling_copy.bullet_points,
    },
    images: output.images.map(({ notes: _notes, ...image }) => image),
    compliance: output.compliance,
  };
}

async function collectCompetitorSignals(ctx: AgentContext): Promise<CompetitorStyleSignal[]> {
  try {
    const search = await ctx.providers.shopee.searchProducts({
      query: ctx.brief.product_intent,
      market: ctx.brief.target_market,
      category: ctx.brief.category,
      limit: 3,
    });
    const primary = search.products[0];
    const detail = primary?.item_id ? await ctx.providers.shopee.getProductDetail({ itemId: primary.item_id }) : undefined;

    return search.products.map((product) => ({
      source: product.product_url ?? search.source.source_url ?? search.source.fixture_id ?? "shopee-seed",
      title: product.title,
      evidence_label: product.evidence_label,
      style_notes:
        detail?.product.item_id === product.item_id
          ? detail.product.style_notes
          : [product.evidence_label, product.shop_type ? `${product.shop_type} listing style` : ""].filter(Boolean),
    }));
  } catch {
    return [];
  }
}

async function collectPolicyRules(ctx: AgentContext): Promise<string[]> {
  try {
    const result = await ctx.providers.shopee.getPolicyRules({ market: ctx.brief.target_market });
    return result.rules
      .filter((rule) => rule.applies_to.some((target) => ["image", "feature_image", "packaging", "listing"].includes(target)))
      .flatMap((rule) => [rule.title, rule.guidance]);
  } catch {
    return [];
  }
}

function collectProductSpecs(listing: SelectedListing, opportunity: Opportunity | undefined): Record<string, string | number | boolean> {
  return {
    item_name: listing.shopee.item_name,
    category: listing.shopee.category,
    brand: listing.shopee.brand,
    price: listing.shopee.price,
    weight_g: listing.shopee.logistics.weight_g,
    length_cm: listing.shopee.logistics.length_cm,
    width_cm: listing.shopee.logistics.width_cm,
    height_cm: listing.shopee.logistics.height_cm,
    source_price: opportunity?.source_price ?? "",
    fulfillment_days: opportunity?.fulfillment_days ?? "",
    ...listing.shopee.attributes,
  };
}

function collectRiskWarnings(ctx: AgentContext, listing: SelectedListing): string[] {
  const riskWarnings = ctx.results.agents?.find((agent) => agent.key === "risk")?.warnings ?? [];
  return uniqueList([...listing.compliance.warnings, ...riskWarnings]);
}

function buildImagePrompts(input: PackagingInput, profile: LocalPreferenceProfile): PackagingPrompt[] {
  const productAttributes = collectAllowedPromptProductAttributes(profile);
  const bannedClaims = profile.grounded_product_facts.banned_claims;
  const localStyleNotes = uniqueList([
    ...profile.visual_style,
    ...profile.local_scene_cues,
    profile.image_pattern.hero.composition,
    profile.image_pattern.hero.background,
  ]);
  const baseConstraints = {
    product_attributes: productAttributes,
    banned_claims: bannedClaims,
    local_market: profile.market,
    local_style_notes: localStyleNotes,
  };
  const productName = sanitizeText(input.selected_listing.shopee.item_name, bannedClaims);
  const lifestyleScene = profile.image_pattern.lifestyle.scene;
  const lifestyleProps = profile.image_pattern.lifestyle.props.join(", ");
  const featureCallouts = allowedFeatureCallouts(profile).join(", ");

  return [
    {
      type: "hero",
      prompt: [
        `${profile.platform} ${profile.market} ecommerce hero image for ${productName}.`,
        `${profile.image_pattern.hero.composition} on ${profile.image_pattern.hero.background}.`,
        `Grounded attributes: ${productAttributes.join(", ")}.`,
        `Style cues from tool-backed local preference evidence: ${localStyleNotes.join("; ")}.`,
        "No text, no logo, no badge, no certification mark, no exaggerated suction effect.",
      ].join(" "),
      constraints: baseConstraints,
    },
    {
      type: "lifestyle",
      prompt: [
        `Realistic lifestyle image for ${productName}.`,
        `Show practical use in this evidenced scene: ${lifestyleScene}.`,
        lifestyleProps ? `Use only simple props supported by evidence: ${lifestyleProps}.` : "",
        `Keep the setup practical and small-space friendly.`,
        "No wet mess, heavy debris, floor cleaning, car cleaning, children, dramatic airflow, or certification badge.",
      ]
        .filter(Boolean)
        .join(" "),
      constraints: baseConstraints,
    },
    {
      type: "feature",
      prompt: [
        `Simple ${profile.platform} feature image for ${productName}.`,
        `Use only these factual callouts: ${featureCallouts}.`,
        `Clean infographic layout, product visible, callouts aligned to listing specs.`,
        "No unsupported battery-life, safety certification, HEPA, germ-killing, wet-cleaning, or industrial claims.",
      ].join(" "),
      constraints: baseConstraints,
    },
  ];
}

function buildSellingCopy(
  input: PackagingInput,
  profile: LocalPreferenceProfile,
): PackagingOutput["selling_copy"] {
  const listing = input.selected_listing.shopee;
  const productAttributes = collectAllowedPromptProductAttributes(profile);
  const bannedClaims = profile.grounded_product_facts.banned_claims;
  const useLimits = inferUseLimits(input);
  const fulfillmentNote = input.opportunity?.fulfillment_days
    ? `Ships from overseas, estimated delivery ${input.opportunity.fulfillment_days}-${Math.max(input.opportunity.fulfillment_days + 2, input.brief.max_fulfillment_days)} days.`
    : existingFulfillmentNote(listing.description);
  const useCases = profile.copy_pattern.buyer_use_cases.join(", ");
  const titleTerms = profile.title_pattern.must_include_terms.filter((term) => !containsAny(term, bannedClaims));
  const bulletPoints = uniqueList([
    ...listing.bullet_points,
    ...titleTerms,
    ...profile.preferred_terms.filter((term) => productAttributes.some((attribute) => includesNormalized(attribute, term))),
  ])
    .map((value) => sanitizeText(value, bannedClaims))
    .filter(Boolean)
    .slice(0, 5);

  return {
    item_name: sanitizeText(listing.item_name, bannedClaims),
    description: sanitizeText(
      [
        useCases ? `${listing.item_name} for ${useCases}.` : `${listing.item_name} with evidenced specs only.`,
        productAttributes.length ? `Key specs: ${productAttributes.slice(0, 6).join(", ")}.` : "",
        useLimits,
        fulfillmentNote,
      ]
        .filter(Boolean)
        .join("\n\n"),
      bannedClaims,
    ),
    bullet_points: bulletPoints.length ? bulletPoints : listing.bullet_points.map((value) => sanitizeText(value, bannedClaims)),
  };
}

async function buildDryRunImages(
  input: PackagingInput,
  prompts: PackagingPrompt[],
  ctx: Pick<AgentContext, "providers">,
): Promise<PackagingImageResult[]> {
  return Promise.all(
    prompts.map(async (prompt) => {
      const fallback = input.selected_listing.images.find((image) => image.type === prompt.type);
      const url = fallbackUrl(prompt.type, fallback?.url);
      const compliance = await ctx.providers.openaiImage.checkImageCompliance({
        imageUrl: url,
        prompt: prompt.prompt,
        rules: prompt.constraints.banned_claims,
      });

      return {
        type: prompt.type,
        url,
        prompt: prompt.prompt,
        compliance: maxComplianceStatus(["needs_review", compliance.status]),
        notes: ["Dry-run prompt only; fallback image requires review.", ...compliance.notes],
      };
    }),
  );
}

async function buildLiveImages(
  input: PackagingInput,
  prompts: PackagingPrompt[],
  ctx: Pick<AgentContext, "providers">,
): Promise<PackagingImageResult[]> {
  return Promise.all(
    prompts.map(async (prompt) => {
      try {
        const request = {
          runId: input.run_id,
          prompt: prompt.prompt,
          constraints: {
            asset_type: prompt.type,
            size: prompt.type === "lifestyle" ? "1536x1024" : "1024x1024",
            quality: "low" as const,
            format: "jpeg" as const,
            product_attributes: prompt.constraints.product_attributes,
            banned_claims: prompt.constraints.banned_claims,
            local_market: prompt.constraints.local_market,
            local_style_notes: prompt.constraints.local_style_notes,
          },
        };
        const generated = input.source_image
          ? await ctx.providers.openaiImage.editProductImage({
              ...request,
              sourceImage: input.source_image,
            })
          : await ctx.providers.openaiImage.generateProductImage(request);
        const compliance = await ctx.providers.openaiImage.checkImageCompliance({
          imageUrl: generated.image.url,
          prompt: prompt.prompt,
          rules: prompt.constraints.banned_claims,
        });
        const providerMode = String(generated.image.metadata.provider_mode ?? "");
        const status = providerMode.includes("fallback")
          ? "needs_review"
          : maxComplianceStatus([
              generated.image.compliance,
              compliance.status,
              prompt.type === "feature" ? "needs_review" : "ok",
            ]);

        return {
          type: prompt.type,
          url: generated.image.url,
          prompt: prompt.prompt,
          compliance: status,
          notes: [...(generated.warnings ?? []).map((warning) => warning.message), ...compliance.notes],
        };
      } catch (error) {
        return {
          type: prompt.type,
          url: fallbackUrl(prompt.type, input.selected_listing.images.find((image) => image.type === prompt.type)?.url),
          prompt: prompt.prompt,
          compliance: "needs_review",
          notes: [`Live image generation failed: ${error instanceof Error ? error.message : String(error)}`],
        };
      }
    }),
  );
}

function buildCompliance(
  input: PackagingInput,
  images: PackagingImageResult[],
  checkpoint: RiskCheckpoint,
): PackagingOutput["compliance"] {
  const imageWarnings = images.flatMap((image) =>
    image.compliance === "ok" ? [] : [`${image.type} image marked ${image.compliance}: ${image.notes.join(" ")}`],
  );
  return {
    human_review_required:
      input.selected_listing.compliance.human_review_required ||
      checkpoint.human_review_required ||
      images.some((image) => image.compliance !== "ok"),
    warnings: uniqueList([
      ...input.selected_listing.compliance.warnings,
      ...input.risk_warnings,
      ...checkpoint.warnings,
      ...imageWarnings,
    ]),
  };
}

function buildAgentResult(
  input: PackagingInput,
  profile: LocalPreferenceProfile,
  images: PackagingImageResult[],
  warnings: string[],
  checkpoint: RiskCheckpoint,
): AgentResult {
  const rejectedCount = images.filter((image) => image.compliance === "rejected").length;
  const reviewCount = images.filter((image) => image.compliance === "needs_review").length;
  const score = Math.max(35, Math.round(82 - rejectedCount * 30 - reviewCount * 7 - (1 - profile.confidence) * 10));
  const evidence: Evidence[] = [
    ...profile.evidence,
    {
      label: "Grounded product facts used",
      value: profile.grounded_product_facts.allowed_claims.join("; "),
    },
    {
      label: "Title pattern evidence ids",
      value: profile.title_pattern.rationale_evidence_ids.join("; "),
    },
    {
      label: "Image compliance",
      value: images.map((image) => `${image.type}: ${image.compliance}`).join("; "),
    },
  ];

  return {
    key: "packaging",
    name: packagingSkill.name,
    role: packagingSkill.role,
    status: checkpoint.hard_block ? "blocked" : "done",
    inputs_summary: `${input.selected_listing.platform} ${input.selected_listing.market} · ${input.mode} · local preference research first`,
    data_sources: uniqueList([
      "Local preference research subagent",
      `${input.brief.target_platform} competitor style seed`,
      `${input.brief.target_platform} ${input.brief.target_market} policy rules seed`,
      input.mode === "live" ? "OpenAI image live/fallback" : "OpenAI image dry-run fallback",
    ]),
    evidence,
    key_judgment:
      reviewCount > 0
        ? `Localized copy and prompts are grounded in ${profile.market}/${profile.platform} evidence; review flagged images before launch.`
        : `Localized copy and images are grounded in ${profile.market}/${profile.platform} evidence and passed prompt compliance checks.`,
    score,
    confidence: profile.confidence,
    warnings: uniqueList([
      ...warnings,
      ...(profile.needs_human_review ? ["Preference research has limited evidence or missing product proof; human review required."] : []),
    ]),
  };
}

function collectAllowedPromptProductAttributes(profile: LocalPreferenceProfile): string[] {
  return profile.grounded_product_facts.allowed_claims
    .filter((attribute) => !containsAny(attribute, profile.grounded_product_facts.banned_claims))
    .slice(0, 12);
}

function allowedFeatureCallouts(profile: LocalPreferenceProfile): string[] {
  const claims = profile.image_pattern.feature.allowed_callouts.length
    ? profile.image_pattern.feature.allowed_callouts
    : profile.grounded_product_facts.allowed_claims;
  return claims.filter((attribute) => !containsAny(attribute, profile.grounded_product_facts.banned_claims)).slice(0, 5);
}

function inferUseLimits(input: PackagingInput): string {
  const text = selectedListingText(input.selected_listing);
  const limits = [
    includesNormalized(text, "dry") ? "For dry crumbs and light desktop dust only." : "",
    includesNormalized(text, "wet") ? "" : "Not for wet mess, floor cleaning, or heavy debris.",
  ].filter(Boolean);
  return limits.join(" ");
}

function existingFulfillmentNote(description: string): string {
  return description
    .split(/\n+/)
    .map((line) => line.trim())
    .find((line) => includesNormalized(line, "ships") || includesNormalized(line, "delivery")) ?? "";
}

function sanitizeText(value: string, avoidTerms: string[]): string {
  let output = value;
  for (const term of avoidTerms) {
    const pattern = new RegExp(patternForTerm(term), "gi");
    output = output.replace(pattern, "");
  }
  return output.replace(/\s+/g, " ").replace(/\s+([,.;:])/g, "$1").trim();
}

function fallbackUrl(type: ListingImage["type"], currentUrl: string | undefined): string {
  if (currentUrl && !currentUrl.endsWith(".png")) {
    return currentUrl;
  }
  return `/seed/images/desk-vacuum-${type}.svg`;
}

function readImageMode(): PackagingImageMode {
  return process.env.LIVE_IMAGE_GENERATION === "false" ? "dry-run" : "live";
}

function containsAny(value: string, terms: string[]): boolean {
  return terms.some((term) => includesNormalized(value, term));
}

function includesNormalized(value: string, term: string): boolean {
  const normalizedTerm = normalize(term);
  if (isShortCertificationTerm(normalizedTerm)) {
    return new RegExp(`\\b${escapeRegExp(normalizedTerm)}\\b`, "i").test(normalize(value));
  }
  return normalize(value).includes(normalizedTerm);
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

function patternForTerm(value: string): string {
  const normalized = normalize(value);
  if (isShortCertificationTerm(normalized)) {
    return `\\b${escapeRegExp(normalized)}\\b`;
  }
  return escapeRegExp(value);
}

function isShortCertificationTerm(value: string): boolean {
  return /^[a-z0-9]{2,3}$/.test(value);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
