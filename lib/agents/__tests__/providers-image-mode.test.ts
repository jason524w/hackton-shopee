import { afterEach, describe, expect, it, vi } from "vitest";

import { createOrchestrationProviders } from "../orchestrate";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createOrchestrationProviders image provider wiring", () => {
  it("uses a dry-run image provider for imageMode=dry-run (no API call)", async () => {
    const providers = createOrchestrationProviders("dry-run");
    const result = await providers.openaiImage.generateProductImage({ prompt: "hero shot" });
    expect(result.image.metadata.provider_mode).toBe("dry-run");
  });

  it("uses the live image provider for imageMode=live", async () => {
    // Force the no-key path so the live provider deterministically falls back instead
    // of hitting the OpenAI API — proves we wired the LIVE provider, not the seed one.
    // H5: live failures rethrow by default; opt into the visible fallback to observe it here.
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubEnv("ALLOW_IMAGE_FALLBACK", "1");
    const providers = createOrchestrationProviders("live");
    const result = await providers.openaiImage.generateProductImage({ prompt: "hero shot" });
    expect(result.image.metadata.provider_mode).toBe("live-fallback");
  });
});
