import { afterEach, describe, expect, it, vi } from "vitest";

import { createSeedProviders } from "../orchestrate";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("createSeedProviders image provider wiring", () => {
  it("uses a dry-run image provider for imageMode=dry-run (no API call)", async () => {
    const providers = createSeedProviders("dry-run");
    const result = await providers.openaiImage.generateProductImage({ prompt: "hero shot" });
    expect(result.image.metadata.provider_mode).toBe("dry-run");
  });

  it("uses the live image provider for imageMode=live", async () => {
    // Force the no-key path so the live provider deterministically falls back instead
    // of hitting the OpenAI API — proves we wired the LIVE provider, not the seed one.
    vi.stubEnv("OPENAI_API_KEY", "");
    const providers = createSeedProviders("live");
    const result = await providers.openaiImage.generateProductImage({ prompt: "hero shot" });
    expect(result.image.metadata.provider_mode).toBe("live-fallback");
  });
});
