import type {
  AgentResult,
  Brief,
  Evidence,
  ListingImage,
  Opportunity,
  SelectedListing,
} from "../../../contract/result";
import type { JsonSchema } from "../../agent-runtime/schemas";
import type { ImageComplianceStatus } from "../../providers/openai-image/types";

export type PackagingImageMode = "dry-run" | "live";
export type PackagingAssetType = "hero" | "lifestyle" | "feature";

export interface CompetitorStyleSignal {
  source: string;
  title?: string;
  style_notes: string[];
  evidence_label?: string;
}

export interface PackagingInput {
  run_id: string;
  mode: PackagingImageMode;
  brief: Brief;
  selected_listing: SelectedListing;
  opportunity?: Opportunity;
  competitor_signals: CompetitorStyleSignal[];
  product_specs: Record<string, string | number | boolean>;
  policy_rules: string[];
  risk_warnings: string[];
  source_image?: string;
}

export interface PreferenceEvidenceItem {
  id: string;
  source: string;
  quote_or_fact: string;
}

export interface GroundedProductFacts {
  allowed_claims: string[];
  uncertain_or_missing: string[];
  banned_claims: string[];
}

export interface TitlePattern {
  formula: string;
  must_include_terms: string[];
  avoid_terms: string[];
  rationale_evidence_ids: string[];
}

export interface CopyPattern {
  tone: "factual" | "friendly" | "cute-functional";
  buyer_use_cases: string[];
  bullet_order: string[];
  compliance_notes: string[];
}

export interface ImagePattern {
  hero: { composition: string; background: string; text_overlay: boolean };
  lifestyle: { scene: string; props: string[]; local_context: string[] };
  feature: { allowed_callouts: string[]; needs_review_reasons: string[] };
}

export interface LocalPreferenceProfile {
  market: string;
  platform: string;
  category: string;
  evidence_items: PreferenceEvidenceItem[];
  grounded_product_facts: GroundedProductFacts;
  title_pattern: TitlePattern;
  copy_pattern: CopyPattern;
  image_pattern: ImagePattern;
  copy_style: string[];
  visual_style: string[];
  local_scene_cues: string[];
  preferred_terms: string[];
  avoid_terms: string[];
  evidence: Evidence[];
  confidence: number;
  needs_human_review: boolean;
}

export interface PackagingPrompt {
  type: PackagingAssetType;
  prompt: string;
  constraints: {
    product_attributes: string[];
    banned_claims: string[];
    local_market: string;
    local_style_notes: string[];
  };
}

export interface PackagingImageResult extends ListingImage {
  notes: string[];
}

export interface PackagingOutput {
  preference_profile: LocalPreferenceProfile;
  selling_copy: {
    item_name: string;
    description: string;
    bullet_points: string[];
  };
  prompts: PackagingPrompt[];
  images: PackagingImageResult[];
  compliance: {
    human_review_required: boolean;
    warnings: string[];
  };
  agent: AgentResult;
}

const evidenceSchema: JsonSchema = {
  type: "object",
  properties: {
    label: { type: "string" },
    value: { type: "string" },
  },
  required: ["label", "value"],
  additionalProperties: false,
};

const preferenceEvidenceItemSchema: JsonSchema = {
  type: "object",
  properties: {
    id: { type: "string" },
    source: { type: "string" },
    quote_or_fact: { type: "string" },
  },
  required: ["id", "source", "quote_or_fact"],
  additionalProperties: false,
};

export const localPreferenceProfileSchema: JsonSchema = {
  type: "object",
  properties: {
    market: { type: "string" },
    platform: { type: "string" },
    category: { type: "string" },
    evidence_items: { type: "array", items: preferenceEvidenceItemSchema },
    grounded_product_facts: {
      type: "object",
      properties: {
        allowed_claims: { type: "array", items: { type: "string" } },
        uncertain_or_missing: { type: "array", items: { type: "string" } },
        banned_claims: { type: "array", items: { type: "string" } },
      },
      required: ["allowed_claims", "uncertain_or_missing", "banned_claims"],
      additionalProperties: false,
    },
    title_pattern: {
      type: "object",
      properties: {
        formula: { type: "string" },
        must_include_terms: { type: "array", items: { type: "string" } },
        avoid_terms: { type: "array", items: { type: "string" } },
        rationale_evidence_ids: { type: "array", items: { type: "string" } },
      },
      required: ["formula", "must_include_terms", "avoid_terms", "rationale_evidence_ids"],
      additionalProperties: false,
    },
    copy_pattern: {
      type: "object",
      properties: {
        tone: { enum: ["factual", "friendly", "cute-functional"] },
        buyer_use_cases: { type: "array", items: { type: "string" } },
        bullet_order: { type: "array", items: { type: "string" } },
        compliance_notes: { type: "array", items: { type: "string" } },
      },
      required: ["tone", "buyer_use_cases", "bullet_order", "compliance_notes"],
      additionalProperties: false,
    },
    image_pattern: {
      type: "object",
      properties: {
        hero: {
          type: "object",
          properties: {
            composition: { type: "string" },
            background: { type: "string" },
            text_overlay: { type: "boolean" },
          },
          required: ["composition", "background", "text_overlay"],
          additionalProperties: false,
        },
        lifestyle: {
          type: "object",
          properties: {
            scene: { type: "string" },
            props: { type: "array", items: { type: "string" } },
            local_context: { type: "array", items: { type: "string" } },
          },
          required: ["scene", "props", "local_context"],
          additionalProperties: false,
        },
        feature: {
          type: "object",
          properties: {
            allowed_callouts: { type: "array", items: { type: "string" } },
            needs_review_reasons: { type: "array", items: { type: "string" } },
          },
          required: ["allowed_callouts", "needs_review_reasons"],
          additionalProperties: false,
        },
      },
      required: ["hero", "lifestyle", "feature"],
      additionalProperties: false,
    },
    copy_style: { type: "array", items: { type: "string" } },
    visual_style: { type: "array", items: { type: "string" } },
    local_scene_cues: { type: "array", items: { type: "string" } },
    preferred_terms: { type: "array", items: { type: "string" } },
    avoid_terms: { type: "array", items: { type: "string" } },
    evidence: { type: "array", items: evidenceSchema },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    needs_human_review: { type: "boolean" },
  },
  required: [
    "market",
    "platform",
    "category",
    "evidence_items",
    "grounded_product_facts",
    "title_pattern",
    "copy_pattern",
    "image_pattern",
    "copy_style",
    "visual_style",
    "local_scene_cues",
    "preferred_terms",
    "avoid_terms",
    "evidence",
    "confidence",
    "needs_human_review",
  ],
  additionalProperties: false,
};

export const packagingOutputSchema: JsonSchema = {
  type: "object",
  properties: {
    preference_profile: localPreferenceProfileSchema,
    selling_copy: {
      type: "object",
      properties: {
        item_name: { type: "string" },
        description: { type: "string" },
        bullet_points: { type: "array", items: { type: "string" } },
      },
      required: ["item_name", "description", "bullet_points"],
      additionalProperties: false,
    },
    prompts: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          type: { enum: ["hero", "lifestyle", "feature"] },
          prompt: { type: "string" },
          constraints: {
            type: "object",
            properties: {
              product_attributes: { type: "array", items: { type: "string" } },
              banned_claims: { type: "array", items: { type: "string" } },
              local_market: { type: "string" },
              local_style_notes: { type: "array", items: { type: "string" } },
            },
            required: ["product_attributes", "banned_claims", "local_market", "local_style_notes"],
            additionalProperties: false,
          },
        },
        required: ["type", "prompt", "constraints"],
        additionalProperties: false,
      },
    },
    images: {
      type: "array",
      minItems: 3,
      maxItems: 3,
      items: {
        type: "object",
        properties: {
          type: { enum: ["hero", "lifestyle", "feature"] },
          url: { type: "string" },
          prompt: { type: "string" },
          compliance: { enum: ["ok", "needs_review", "rejected"] },
          notes: { type: "array", items: { type: "string" } },
        },
        required: ["type", "url", "prompt", "compliance", "notes"],
        additionalProperties: false,
      },
    },
    compliance: {
      type: "object",
      properties: {
        human_review_required: { type: "boolean" },
        warnings: { type: "array", items: { type: "string" } },
      },
      required: ["human_review_required", "warnings"],
      additionalProperties: false,
    },
    agent: { type: "object", additionalProperties: true },
  },
  required: ["preference_profile", "selling_copy", "prompts", "images", "compliance", "agent"],
  additionalProperties: false,
};

export function maxComplianceStatus(statuses: ImageComplianceStatus[]): ImageComplianceStatus {
  if (statuses.includes("rejected")) {
    return "rejected";
  }
  if (statuses.includes("needs_review")) {
    return "needs_review";
  }
  return "ok";
}
