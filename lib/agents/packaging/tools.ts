import type { AgentTool } from "../../agent-runtime/tool-runner";
import type { OpenAIImageProvider } from "../../providers/openai-image/types";
import {
  extractCompetitorStyle,
  extractPolicyConstraints,
  extractProductFacts,
} from "./local-preference";
import type { PackagingAssetType, PackagingInput } from "./schema";

export function createPackagingTools(openaiImage: OpenAIImageProvider): AgentTool[] {
  return [
    {
      name: "extract_competitor_style",
      description:
        "Extract Shopee competitor title, copy, local scene, and image style patterns from provided competitor evidence only.",
      parameters: packagingInputToolSchema(),
      execute: (input) => extractCompetitorStyle((input as { packaging_input: PackagingInput }).packaging_input),
    },
    {
      name: "extract_product_facts",
      description:
        "Extract real product facts and allowed image/copy callouts from listing output and product specs.",
      parameters: packagingInputToolSchema(),
      execute: (input) => extractProductFacts((input as { packaging_input: PackagingInput }).packaging_input),
    },
    {
      name: "extract_policy_constraints",
      description:
        "Extract banned claims and compliance notes from Shopee policy rules, risk warnings, and sensitive claims in listing text.",
      parameters: packagingInputToolSchema(),
      execute: (input) => extractPolicyConstraints((input as { packaging_input: PackagingInput }).packaging_input),
    },
    {
      name: "generate_product_image",
      description: "Generate a product image through the OpenAI image provider.",
      parameters: {
        type: "object",
        properties: {
          runId: { type: "string" },
          prompt: { type: "string" },
          asset_type: { type: "string", enum: ["hero", "lifestyle", "feature"] },
        },
        required: ["runId", "prompt", "asset_type"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { runId: string; prompt: string; asset_type: PackagingAssetType };
        return openaiImage.generateProductImage({
          runId: value.runId,
          prompt: value.prompt,
          constraints: { asset_type: value.asset_type },
        });
      },
    },
    {
      name: "edit_product_image",
      description:
        "Create a localized ecommerce asset with an optional source image reference through the OpenAI image provider; provider warnings disclose any reference-only fallback.",
      parameters: {
        type: "object",
        properties: {
          runId: { type: "string" },
          prompt: { type: "string" },
          sourceImage: { type: "string" },
          asset_type: { type: "string", enum: ["hero", "lifestyle", "feature"] },
        },
        required: ["runId", "prompt", "sourceImage", "asset_type"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { runId: string; prompt: string; sourceImage: string; asset_type: PackagingAssetType };
        return openaiImage.editProductImage({
          runId: value.runId,
          prompt: value.prompt,
          sourceImage: value.sourceImage,
          constraints: { asset_type: value.asset_type },
        });
      },
    },
    {
      name: "check_image_compliance",
      description: "Check prompt-backed image compliance for generated or fallback product images.",
      parameters: {
        type: "object",
        properties: {
          imageUrl: { type: "string" },
          prompt: { type: "string" },
          rules: { type: "array", items: { type: "string" } },
        },
        required: ["imageUrl", "prompt", "rules"],
        additionalProperties: false,
      },
      execute: async (input) => {
        const value = input as { imageUrl: string; prompt: string; rules: string[] };
        return openaiImage.checkImageCompliance(value);
      },
    },
  ];
}

function packagingInputToolSchema() {
  return {
    type: "object" as const,
    properties: {
      packaging_input: {
        type: "object" as const,
        additionalProperties: true,
      },
    },
    required: ["packaging_input"],
    additionalProperties: false,
  };
}
