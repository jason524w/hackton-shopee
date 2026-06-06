import type { ProviderResultMeta } from "../shared";

export type ImageAssetType = "feature" | "hero" | "lifestyle";
export type ImageComplianceStatus = "ok" | "needs_review" | "rejected";

export interface ImageGenerationConstraints {
  asset_type?: ImageAssetType;
  size?: string;
  quality?: "low" | "medium" | "high" | "auto";
  format?: "jpeg" | "png" | "webp";
  product_attributes?: string[];
  banned_claims?: string[];
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
  metadata: Record<string, unknown>;
}

export interface GenerateProductImageInput {
  prompt: string;
  constraints?: ImageGenerationConstraints;
}

export interface GenerateProductImageResult extends ProviderResultMeta {
  image: GeneratedImageAsset;
}

export interface EditProductImageInput {
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
