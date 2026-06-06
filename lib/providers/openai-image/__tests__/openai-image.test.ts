import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  createDryRunOpenAIImageProvider,
  createLiveOpenAIImageProvider,
} from "../index";
import type { OpenAIImageClient } from "../types";

describe("openai image provider", () => {
  it("dry-run returns fallback image without calling a live image client", async () => {
    const provider = createDryRunOpenAIImageProvider({ model: "gpt-image-2" });

    const result = await provider.generateProductImage({
      runId: "run_test",
      prompt: "Mini desk vacuum on a clean desk",
      constraints: { asset_type: "hero" },
    });

    expect(result.image.url).toBe("/seed/images/desk-vacuum-hero.svg");
    expect(result.image.compliance).toBe("needs_review");
    expect(result.image.metadata.provider_mode).toBe("dry-run");
    expect(result.warnings?.[0]?.code).toBe("dry_run_image");
  });

  it("live mode writes base64 image bytes under the run directory", async () => {
    const outputRoot = await mkdtemp(join(tmpdir(), "openai-image-"));
    const client: OpenAIImageClient = {
      images: {
        generate: vi.fn(async () => ({
          id: "img_response_123",
          created: 1,
          data: [{ b64_json: Buffer.from("fake-image").toString("base64"), revised_prompt: "revised" }],
          usage: { total_tokens: 10 },
        })),
      },
    };
    const provider = createLiveOpenAIImageProvider({
      client,
      outputRoot,
      publicBasePath: "/generated-test",
      model: "gpt-image-2",
    });

    const result = await provider.generateProductImage({
      runId: "run/live test",
      prompt: "Mini desk vacuum Shopee hero image",
      constraints: { asset_type: "hero", format: "jpeg" },
    });

    expect(client.images.generate).toHaveBeenCalledOnce();
    expect(result.image.url).toMatch(/^\/generated-test\/run_live_test\/hero-.*\.jpg$/);
    expect(result.image.output_path).toMatch(/^public\/generated\/run_live_test\/hero-.*\.jpg$/);
    expect(result.image.response_id).toBe("img_response_123");

    const fileName = result.image.url.split("/").at(-1);
    const bytes = await readFile(join(outputRoot, "run_live_test", fileName ?? ""));
    expect(bytes.toString()).toBe("fake-image");
  });

  it("live failure falls back visibly and marks image for review", async () => {
    const client: OpenAIImageClient = {
      images: {
        generate: vi.fn(async () => {
          throw new Error("quota exhausted");
        }),
      },
    };
    const provider = createLiveOpenAIImageProvider({ client });

    const result = await provider.generateProductImage({
      runId: "run_test",
      prompt: "Mini desk vacuum feature image",
      constraints: { asset_type: "feature" },
    });

    expect(result.image.url).toBe("/seed/images/desk-vacuum-feature.svg");
    expect(result.image.compliance).toBe("needs_review");
    expect(result.image.metadata.provider_mode).toBe("live-fallback");
    expect(result.warnings?.some((warning) => warning.code === "live_image_fallback")).toBe(true);
  });

  it("edit requests do not place raw source image URLs into the generation prompt", async () => {
    const generate = vi.fn(async (_request: { prompt: string }) => ({
      id: "img_response_456",
      created: 1,
      data: [{ b64_json: Buffer.from("edited-image").toString("base64") }],
    }));
    const outputRoot = await mkdtemp(join(tmpdir(), "openai-image-edit-"));
    const provider = createLiveOpenAIImageProvider({
      client: { images: { generate } },
      outputRoot,
      model: "gpt-image-2",
    });

    const result = await provider.editProductImage({
      runId: "run_edit",
      sourceImage: "https://example.com/private/source.png?signature=secret",
      prompt: "Mini desk vacuum source image edit",
      constraints: { asset_type: "hero" },
    });

    const request = generate.mock.calls[0]?.[0];
    expect(request?.prompt).not.toContain("signature=secret");
    expect(request?.prompt).not.toContain("source.png");
    expect(result.image.metadata.source_image_ref).toBe("https://example.com");
    expect(result.image.metadata.edit_degraded_to_generate).toBe(true);
    expect(result.image.compliance).toBe("needs_review");
    expect(result.warnings?.some((warning) => warning.code === "live_image_edit_reference_only")).toBe(true);
  });

  it("dry-run edit metadata redacts source image references", async () => {
    const provider = createDryRunOpenAIImageProvider();

    const result = await provider.editProductImage({
      runId: "run_edit",
      sourceImage: "/Users/example/private/source.png",
      prompt: "Mini desk vacuum source image edit",
      constraints: { asset_type: "hero" },
    });

    expect(result.image.metadata.source_image_ref).toBe("source.png");
    expect(result.image.metadata).not.toHaveProperty("source_image");
  });

  it("compliance checker flags unsupported visual claims", async () => {
    const provider = createDryRunOpenAIImageProvider();

    const result = await provider.checkImageCompliance({
      imageUrl: "/seed/images/desk-vacuum-hero.svg",
      prompt: "Mini desk vacuum with super suction and certified safe badge",
    });

    expect(result.status).toBe("needs_review");
    expect(result.flags).toContain("super suction");
    expect(result.flags).toContain("certified safe");
  });
});
