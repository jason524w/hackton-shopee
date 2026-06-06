import type { ProviderResultMeta } from "../shared";

export type ImageAssetType = "feature" | "hero" | "lifestyle";
export type ImageComplianceStatus = "ok" | "needs_review" | "rejected";
export type OpenAIImageProviderMode = "dry-run" | "live" | "seed";

export interface ImageGenerationConstraints {
  asset_type?: ImageAssetType;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  format?: "jpeg" | "png" | "webp";
  product_attributes?: string[];
  banned_claims?: string[];
  local_market?: string;
  local_style_notes?: string[];
}

export interface GeneratedImageAsset {
  image_id: string;
  type: ImageAssetType;
  url: string;
  prompt: string;
  revised_prompt?: string;
  model: string;
  size: string;
  quality: string;
  compliance: ImageComplianceStatus;
  output_path?: string;
  response_id?: string;
  metadata: Record<string, unknown>;
}

export interface GenerateProductImageInput {
  runId?: string;
  prompt: string;
  constraints?: ImageGenerationConstraints;
}

export interface GenerateProductImageResult extends ProviderResultMeta {
  image: GeneratedImageAsset;
}

export interface EditProductImageInput {
  runId?: string;
  sourceImage: string;
  prompt: string;
  constraints?: ImageGenerationConstraints;
}

export interface EditProductImageResult extends ProviderResultMeta {
  image: GeneratedImageAsset;
}

export interface CheckImageComplianceInput {
  imageUrl: string;
  rules?: string[];
  prompt?: string;
}

export interface CheckImageComplianceResult extends ProviderResultMeta {
  image_url: string;
  status: ImageComplianceStatus;
  notes: string[];
  flags: string[];
}

export interface OpenAIImageProvider {
  generateProductImage(input: GenerateProductImageInput): Promise<GenerateProductImageResult>;
  editProductImage(input: EditProductImageInput): Promise<EditProductImageResult>;
  checkImageCompliance(input: CheckImageComplianceInput): Promise<CheckImageComplianceResult>;
}

export interface OpenAIImageGenerateRequest {
  model: string;
  prompt: string;
  n?: number;
  size?: string;
  quality?: string;
  output_format?: string;
  moderation?: string;
}

export interface OpenAIImageGenerateResponse {
  created?: number;
  data?: Array<{
    b64_json?: string;
    revised_prompt?: string;
    url?: string;
  }>;
  id?: string;
  usage?: Record<string, unknown>;
}

export interface OpenAIImageClient {
  images: {
    generate(request: OpenAIImageGenerateRequest): Promise<OpenAIImageGenerateResponse>;
  };
}

export interface CreateOpenAIImageProviderOptions {
  mode?: OpenAIImageProviderMode;
  client?: OpenAIImageClient;
  model?: string;
  outputRoot?: string;
  publicBasePath?: string;
  fallbackProvider?: OpenAIImageProvider;
}
