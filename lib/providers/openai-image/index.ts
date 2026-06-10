import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { UNSUPPORTED_PRODUCT_CLAIMS } from "../../compliance/claims";
import { getOpenAIClient, OPENAI_IMAGE_MODEL } from "../../openai";
import { includesQuery, normalizeQuery, nowIso, readSeedJson } from "../shared";
import type {
  CheckImageComplianceInput,
  CheckImageComplianceResult,
  CreateOpenAIImageProviderOptions,
  EditProductImageInput,
  EditProductImageResult,
  GeneratedImageAsset,
  GenerateProductImageInput,
  GenerateProductImageResult,
  ImageAssetType,
  ImageComplianceStatus,
  OpenAIImageClient,
  OpenAIImageGenerateRequest,
  OpenAIImageProvider,
  OpenAIImageProviderMode,
} from "./types";

const DEFAULT_IMAGE_MODEL = "gpt-image-2";
const DEFAULT_IMAGE_SIZE = "1024x1024";
const DEFAULT_IMAGE_QUALITY = "low";
const DEFAULT_IMAGE_FORMAT = "jpeg";
interface ImageSeed {
  fixture_id: string;
  captured_at: string;
  model: string;
  assets: GeneratedImageAsset[];
}

export function createOpenAIImageProvider(options: CreateOpenAIImageProviderOptions = {}): OpenAIImageProvider {
  const mode = options.mode ?? readDefaultMode();
  if (mode === "live") {
    return createLiveOpenAIImageProvider(options);
  }
  if (mode === "dry-run") {
    return createDryRunOpenAIImageProvider(options);
  }
  return createSeedOpenAIImageProvider();
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
            source_image_ref: redactSourceImage(input.sourceImage),
            requested_constraints: input.constraints ?? {},
          },
        },
      };
    },

    async checkImageCompliance(input: CheckImageComplianceInput): Promise<CheckImageComplianceResult> {
      const seed = await readSeedJson<ImageSeed>("seed/openai-image/mini-desk-vacuum-images.json");
      const matchedAsset = seed.assets.find((asset) => asset.url === input.imageUrl);
      const text = normalizeQuery(`${input.prompt ?? ""} ${matchedAsset?.prompt ?? ""}`);
      const bannedClaims = [...UNSUPPORTED_PRODUCT_CLAIMS, ...(input.rules ?? [])].filter(Boolean);
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

export function createDryRunOpenAIImageProvider(
  options: Pick<CreateOpenAIImageProviderOptions, "model"> = {},
): OpenAIImageProvider {
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
            code: "dry_run_image",
            severity: "info",
            message: "Dry-run image response: prompt generated without calling the OpenAI image API.",
          },
        ],
        image: {
          ...image,
          prompt: input.prompt,
          model: options.model ?? process.env.OPENAI_IMAGE_MODEL ?? seed.model ?? DEFAULT_IMAGE_MODEL,
          size: input.constraints?.size ?? image.size,
          quality: input.constraints?.quality ?? image.quality,
          compliance: "needs_review",
          metadata: {
            ...image.metadata,
            provider_mode: "dry-run",
            requested_constraints: input.constraints ?? {},
            fallback_url: image.url,
          },
        },
      };
    },

    async editProductImage(input: EditProductImageInput): Promise<EditProductImageResult> {
      const generated = await this.generateProductImage({
        runId: input.runId,
        prompt: input.prompt,
        constraints: input.constraints,
      });

      return {
        ...generated,
        warnings: [
          ...(generated.warnings ?? []),
          {
            code: "dry_run_image_edit",
            severity: "info",
            message: "Dry-run image edit response: source image was not sent to the OpenAI image API.",
          },
        ],
        image: {
          ...generated.image,
          metadata: {
            ...generated.image.metadata,
            source_image_ref: redactSourceImage(input.sourceImage),
          },
        },
      };
    },

    checkImageCompliance,
  };
}

export function createLiveOpenAIImageProvider(options: CreateOpenAIImageProviderOptions = {}): OpenAIImageProvider {
  const fallbackProvider = options.fallbackProvider ?? createDryRunOpenAIImageProvider({ model: options.model });

  return {
    async generateProductImage(input: GenerateProductImageInput): Promise<GenerateProductImageResult> {
      try {
        return await generateLiveImage(input, options);
      } catch (error) {
        // 503-not-degrade philosophy: a live image failure should surface as a pipeline error by
        // default, NOT silently ship a seed/canned image. Only fall back when explicitly opted in.
        if (!imageFallbackEnabled()) {
          throw error;
        }
        const fallback = await fallbackProvider.generateProductImage(input);
        return {
          ...fallback,
          warnings: [
            ...(fallback.warnings ?? []),
            {
              code: "live_image_fallback",
              severity: "warning",
              message: "Live image generation failed; returned fallback image and marked it for review.",
            },
          ],
          image: {
            ...fallback.image,
            compliance: "needs_review",
            metadata: {
              ...fallback.image.metadata,
              provider_mode: "live-fallback",
              fallback_error: error instanceof Error ? error.message : String(error),
            },
          },
        };
      }
    },

    async editProductImage(input: EditProductImageInput): Promise<EditProductImageResult> {
      const promptWithReference = [
        input.prompt,
        "Use the provided source product image only as a factual visual reference.",
      ].join("\n");
      const generated = await this.generateProductImage({
        runId: input.runId,
        prompt: promptWithReference,
        constraints: input.constraints,
      });

      return {
        ...generated,
        warnings: [
          ...(generated.warnings ?? []),
          {
            code: "live_image_edit_reference_only",
            severity: "warning",
            message:
              "Live image edit is reference-only in this MVP; source image was redacted and not uploaded to an image edit endpoint.",
          },
        ],
        image: {
          ...generated.image,
          compliance: "needs_review",
          prompt: input.prompt,
          metadata: {
            ...generated.image.metadata,
            source_image_ref: redactSourceImage(input.sourceImage),
            edit_degraded_to_generate: true,
          },
        },
      };
    },

    checkImageCompliance,
  };
}

export const openaiImageProvider = createOpenAIImageProvider();
export type * from "./types";

async function generateLiveImage(
  input: GenerateProductImageInput,
  options: CreateOpenAIImageProviderOptions,
): Promise<GenerateProductImageResult> {
  const model = options.model ?? process.env.OPENAI_IMAGE_MODEL ?? OPENAI_IMAGE_MODEL ?? DEFAULT_IMAGE_MODEL;
  const assetType = input.constraints?.asset_type ?? inferAssetType(input.prompt);
  const format = input.constraints?.format ?? DEFAULT_IMAGE_FORMAT;
  const size = input.constraints?.size ?? DEFAULT_IMAGE_SIZE;
  const quality = input.constraints?.quality ?? DEFAULT_IMAGE_QUALITY;
  const request: OpenAIImageGenerateRequest = {
    model,
    prompt: input.prompt,
    n: 1,
    size,
    quality,
    output_format: format,
    moderation: "auto",
  };
  const client = options.client ?? (getOpenAIClient() as unknown as OpenAIImageClient);
  const startedAt = nowIso();
  const result = await client.images.generate(request);
  const completedAt = nowIso();
  const firstImage = result.data?.[0];

  if (!firstImage?.b64_json) {
    throw new Error("OpenAI image response did not include b64_json output.");
  }

  const runId = sanitizePathPart(input.runId ?? "run_unknown");
  const outputRoot = options.outputRoot ?? join(process.cwd(), "public", "generated");
  const publicBasePath = trimTrailingSlash(options.publicBasePath ?? "/generated");
  const fileName = `${assetType}-${Date.now()}-${Math.random().toString(16).slice(2)}.${extensionForFormat(format)}`;
  const outputDir = join(outputRoot, runId);
  const outputPath = join(outputDir, fileName);
  await mkdir(outputDir, { recursive: true });
  await writeFile(outputPath, Buffer.from(firstImage.b64_json, "base64"));

  const publicUrl = `${publicBasePath}/${runId}/${fileName}`;
  const relativeOutputPath = `public/generated/${runId}/${fileName}`;

  return {
    source: {
      provider: "openai-image",
      mode: "live",
      captured_at: completedAt,
    },
    image: {
      image_id: `generated-${runId}-${assetType}-${Date.now()}`,
      type: assetType,
      url: publicUrl,
      prompt: input.prompt,
      revised_prompt: firstImage.revised_prompt,
      model,
      size,
      quality,
      compliance: "needs_review",
      output_path: relativeOutputPath,
      response_id: result.id,
      metadata: {
        provider_mode: "live",
        requested_constraints: input.constraints ?? {},
        output_format: format,
        output_path: relativeOutputPath,
        public_url: publicUrl,
        response_id: result.id,
        response_created: result.created,
        usage: result.usage,
        started_at: startedAt,
        completed_at: completedAt,
      },
    },
  };
}

async function checkImageCompliance(input: CheckImageComplianceInput): Promise<CheckImageComplianceResult> {
  const seed = await readSeedJson<ImageSeed>("seed/openai-image/mini-desk-vacuum-images.json");
  const matchedAsset = seed.assets.find((asset) => asset.url === input.imageUrl);
  const text = normalizeQuery(`${input.prompt ?? ""} ${matchedAsset?.prompt ?? ""}`);
  const bannedClaims = [...UNSUPPORTED_PRODUCT_CLAIMS, ...(input.rules ?? [])].filter(Boolean);
  const flags = bannedClaims.filter((claim) => text.includes(normalizeQuery(claim)));
  const featureNeedsReview = text.includes("feature") || text.includes("callout") || text.includes("infographic");
  const status: ImageComplianceStatus =
    flags.length > 0 ? "needs_review" : matchedAsset?.compliance ?? (featureNeedsReview ? "needs_review" : "ok");

  return {
    source: {
      provider: "openai-image",
      mode: matchedAsset ? "seed" : "live",
      fixture_id: matchedAsset ? seed.fixture_id : undefined,
      source_url: input.imageUrl,
      captured_at: nowIso(),
    },
    image_url: input.imageUrl,
    status,
    notes:
      flags.length > 0
        ? [`Prompt or seed metadata contains review terms: ${flags.join(", ")}`]
        : featureNeedsReview
          ? ["Feature/callout image should be checked against exact supplier specs before launch."]
          : ["No banned visual claim detected in prompt-backed compliance check."],
    flags,
  };
}

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

function imageFallbackEnabled(): boolean {
  return process.env.ALLOW_IMAGE_FALLBACK === "1";
}

function readDefaultMode(): OpenAIImageProviderMode {
  if (process.env.LIVE_IMAGE_GENERATION === "false") {
    return "dry-run";
  }
  if (process.env.OPENAI_API_KEY) {
    return "live";
  }
  return "seed";
}

function sanitizePathPart(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 80) || "run_unknown";
}

function trimTrailingSlash(value: string): string {
  return value.endsWith("/") ? value.slice(0, -1) : value;
}

function extensionForFormat(format: string): string {
  return format === "jpeg" ? "jpg" : format;
}

function redactSourceImage(sourceImage: string): string {
  if (/^https?:\/\//i.test(sourceImage)) {
    try {
      return new URL(sourceImage).origin;
    } catch {
      return "remote-image";
    }
  }
  return sourceImage.split("/").filter(Boolean).at(-1) ?? "source-image";
}
