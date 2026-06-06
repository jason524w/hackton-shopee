import { includesQuery, normalizeQuery, readSeedJson } from "../shared";
import type {
  CheckImageComplianceInput,
  CheckImageComplianceResult,
  EditProductImageInput,
  EditProductImageResult,
  GeneratedImageAsset,
  GenerateProductImageInput,
  GenerateProductImageResult,
  ImageAssetType,
  ImageComplianceStatus,
  OpenAIImageProvider,
} from "./types";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_BANNED_CLAIMS = ["super suction", "industrial grade", "medical grade", "certified safe"];

interface ImageSeed {
  fixture_id: string;
  captured_at: string;
  model: string;
  assets: GeneratedImageAsset[];
}

export function createSeedOpenAIImageProvider(): OpenAIImageProvider {
  return {
    async generateProductImage(input: GenerateProductImageInput): Promise<GenerateProductImageResult> {
      const seed = await readSeedJson<ImageSeed>("seed/openai-image/mini-desk-vacuum-images.json");
      const assetType = input.constraints?.asset_type ?? inferAssetType(input.prompt);
      const image = chooseAsset(seed, assetType, input.prompt);

      return {
        source: {
          provider: "openai-image",
          mode: "seed",
          fixture_id: seed.fixture_id,
          captured_at: seed.captured_at,
        },
        warnings: [
          {
            code: "seed_image",
            severity: "info",
            message: "Seed-backed image response. Replace provider implementation for live image generation.",
          },
        ],
        image: {
          ...image,
          prompt: input.prompt,
          model: process.env.OPENAI_IMAGE_MODEL ?? seed.model ?? DEFAULT_IMAGE_MODEL,
          size: input.constraints?.size ?? image.size,
          quality: input.constraints?.quality ?? image.quality,
          metadata: {
            ...image.metadata,
            provider_mode: "seed",
            requested_constraints: input.constraints ?? {},
          },
        },
      };
    },

    async editProductImage(input: EditProductImageInput): Promise<EditProductImageResult> {
      const seed = await readSeedJson<ImageSeed>("seed/openai-image/mini-desk-vacuum-images.json");
      const assetType = input.constraints?.asset_type ?? inferAssetType(input.prompt);
      const image = chooseAsset(seed, assetType, input.prompt);

      return {
        source: {
          provider: "openai-image",
          mode: "seed",
          fixture_id: seed.fixture_id,
          captured_at: seed.captured_at,
        },
        warnings: [
          {
            code: "seed_image_edit",
            severity: "info",
            message: "Seed-backed edited image response. Replace provider implementation for live image editing.",
          },
        ],
        image: {
          ...image,
          prompt: input.prompt,
          model: process.env.OPENAI_IMAGE_MODEL ?? seed.model ?? DEFAULT_IMAGE_MODEL,
          size: input.constraints?.size ?? image.size,
          quality: input.constraints?.quality ?? image.quality,
          metadata: {
            ...image.metadata,
            provider_mode: "seed",
            source_image: input.sourceImage,
            requested_constraints: input.constraints ?? {},
          },
        },
      };
    },

    async checkImageCompliance(input: CheckImageComplianceInput): Promise<CheckImageComplianceResult> {
      const seed = await readSeedJson<ImageSeed>("seed/openai-image/mini-desk-vacuum-images.json");
      const matchedAsset = seed.assets.find((asset) => asset.url === input.imageUrl);
      const text = normalizeQuery(`${input.prompt ?? ""} ${matchedAsset?.prompt ?? ""}`);
      const bannedClaims = [...DEFAULT_BANNED_CLAIMS, ...(input.rules ?? [])].filter(Boolean);
      const flags = bannedClaims.filter((claim) => text.includes(normalizeQuery(claim)));
      const status: ImageComplianceStatus =
        flags.length > 0 ? "needs_review" : matchedAsset?.compliance ?? "needs_review";

      return {
        source: {
          provider: "openai-image",
          mode: "seed",
          fixture_id: seed.fixture_id,
          source_url: input.imageUrl,
          captured_at: seed.captured_at,
        },
        image_url: input.imageUrl,
        status,
        notes:
          flags.length > 0
            ? [`Prompt or seed metadata contains review terms: ${flags.join(", ")}`]
            : ["No banned visual claim detected in seed-backed compliance check."],
        flags,
      };
    },
  };
}

export const openaiImageProvider = createSeedOpenAIImageProvider();
export type * from "./types";

function chooseAsset(seed: ImageSeed, assetType: ImageAssetType, prompt: string): GeneratedImageAsset {
  return (
    seed.assets.find((asset) => asset.type === assetType && includesQuery(`${asset.prompt} ${asset.type}`, prompt)) ??
    seed.assets.find((asset) => asset.type === assetType) ??
    seed.assets[0]
  );
}

function inferAssetType(prompt: string): ImageAssetType {
  const normalized = normalizeQuery(prompt);
  if (normalized.includes("lifestyle") || normalized.includes("home office") || normalized.includes("using")) {
    return "lifestyle";
  }
  if (normalized.includes("feature") || normalized.includes("callout") || normalized.includes("infographic")) {
    return "feature";
  }
  return "hero";
}
