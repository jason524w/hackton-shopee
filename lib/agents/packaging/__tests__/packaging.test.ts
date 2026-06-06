import mockResult from "../../../../contract/mock-result.json";
import type { RunResult } from "../../../../contract/result";
import { describe, expect, it, vi } from "vitest";
import { createNoopRisk, type AgentContext, type RiskCheckpoint, type RiskSupervisor } from "../../contracts";
import {
  createSeedFxProvider,
  createSeedShippingProvider,
  createSeedShopeeProvider,
  createSeedSourcing1688Provider,
} from "../../../providers";
import type { ImageComplianceStatus, OpenAIImageProvider } from "../../../providers/openai-image/types";
import { assertOutput } from "../harness";
import { buildPackagingInput, runPackaging, runPackagingAgent } from "../index";
import { createPackagingTools } from "../tools";

describe("packaging agent", () => {
  it("dry-run produces prompts and fallback images without calling image generation", async () => {
    const openaiImage = createSpyImageProvider();
    const risk = createSpyRisk();
    const ctx = createContext(openaiImage, risk);

    const result = await runPackagingAgent(ctx, { imageMode: "dry-run", runId: "run_packaging_test" });

    expect(openaiImage.generateProductImage).not.toHaveBeenCalled();
    expect(openaiImage.editProductImage).not.toHaveBeenCalled();
    expect(openaiImage.checkImageCompliance).toHaveBeenCalledTimes(3);
    expect(risk.checkpoint).toHaveBeenCalledWith("packaging", expect.objectContaining({ prompts: expect.any(Array) }));
    expect(result.selected_listing?.images.map((image) => image.type).sort()).toEqual(["feature", "hero", "lifestyle"]);
    expect(result.selected_listing?.images.every((image) => image.url.endsWith(".svg"))).toBe(true);
    expect(result.selected_listing?.compliance.human_review_required).toBe(true);
  });

  it("local preference research changes when competitor style evidence changes", async () => {
    const baseCtx = createContext(createSpyImageProvider(), createNoopRisk());
    const cleanStyleInput = await buildPackagingInput(baseCtx, {
      imageMode: "dry-run",
      competitorSignals: [
        {
          source: "seed://clean",
          title: "Mini Desk Vacuum Cleaner USB Cordless Keyboard Cleaner",
          style_notes: ["Clean white-background hero image", "Keyboard crumb lifestyle scene"],
        },
      ],
      policyRules: [],
      riskWarnings: [],
    });
    const cuteStyleInput = await buildPackagingInput(baseCtx, {
      imageMode: "dry-run",
      competitorSignals: [
        {
          source: "seed://cute",
          title: "Cute Mini Table Vacuum Keyboard Dust Sweeper",
          style_notes: ["Cute pastel desk setup", "Compact student desk lifestyle scene"],
        },
      ],
      policyRules: [],
      riskWarnings: [],
    });

    const cleanOutput = await runPackaging(cleanStyleInput, baseCtx);
    const cuteOutput = await runPackaging(cuteStyleInput, baseCtx);

    expect(cleanOutput.preference_profile.visual_style).toContain("Clean white-background hero image");
    expect(cuteOutput.preference_profile.visual_style).toContain("Cute pastel desk setup");
    expect(cleanOutput.preference_profile.title_pattern.rationale_evidence_ids[0]).toMatch(/^pref_/);
    expect(cuteOutput.preference_profile.evidence_items.map((item) => item.quote_or_fact)).toContain("Cute pastel desk setup");
    expect(cleanOutput.prompts[0].prompt).not.toEqual(cuteOutput.prompts[0].prompt);
  });

  it("prompts use real specs and SG context while excluding unsupported claims", async () => {
    const ctx = createContext(createSpyImageProvider(), createNoopRisk());
    const input = await buildPackagingInput(ctx, {
      imageMode: "dry-run",
      riskWarnings: ["Avoid super suction, industrial grade, and certified safe claims."],
    });
    const output = await runPackaging(input, ctx);
    const promptText = output.prompts.map((prompt) => prompt.prompt).join("\n").toLowerCase();

    expect(promptText).toContain("usb");
    expect(promptText).toContain("keyboard");
    expect(promptText).toContain("hdb");
    expect(promptText).toContain("180");
    expect(promptText).not.toContain("super suction");
    expect(promptText).not.toContain("industrial grade");
    expect(promptText).not.toContain("certified safe");
    expect(output.selling_copy.item_name).toContain("Home Office");
    expect(output.selling_copy.bullet_points.join(" ")).toContain("fully cordless");
    expect(output.images.find((image) => image.type === "feature")?.compliance).toBe("needs_review");
    for (const prompt of output.prompts) {
      expect(prompt.constraints.product_attributes).toEqual(
        expect.arrayContaining(output.preference_profile.grounded_product_facts.allowed_claims.slice(0, 1)),
      );
      expect(prompt.constraints.banned_claims).toContain("super suction");
      expect(prompt.constraints.banned_claims).toContain("industrial grade");
    }
    expect(output.preference_profile.evidence.find((item) => item.label === "Preference research tools")?.value).toContain(
      "competitor_style_extractor",
    );
  });

  it("does not leak internal supplier economics into public copy, prompts, or evidence", async () => {
    const ctx = createContext(createSpyImageProvider(), createNoopRisk());
    const input = await buildPackagingInput(ctx, {
      imageMode: "dry-run",
      productSpecs: {
        source_price: 3.2,
        internal_cost: 2.4,
        supplier_margin: 0.28,
        fulfillment_days: 8,
        weight_g: 180,
        power_source: "USB Rechargeable",
      },
    });
    const output = await runPackaging(input, ctx);
    const publicText = [
      ...output.prompts.flatMap((prompt) => [
        prompt.prompt,
        prompt.constraints.product_attributes.join(" "),
      ]),
      output.selling_copy.item_name,
      output.selling_copy.description,
      output.selling_copy.bullet_points.join(" "),
      output.preference_profile.grounded_product_facts.allowed_claims.join(" "),
      output.agent.evidence.map((item) => item.value).join(" "),
    ].join("\n");

    expect(publicText).toContain("weight_g: 180");
    expect(publicText).toContain("power_source: USB Rechargeable");
    expect(publicText).not.toContain("source_price");
    expect(publicText).not.toContain("internal_cost");
    expect(publicText).not.toContain("supplier_margin");
    expect(publicText).not.toContain("fulfillment_days");
    expect(publicText).not.toContain("3.2");
    expect(publicText).not.toContain("2.4");
  });

  it("harness accepts negative prompt constraints for unsupported use cases", async () => {
    const ctx = createContext(createSpyImageProvider(), createNoopRisk());
    const input = await buildPackagingInput(ctx, { imageMode: "dry-run" });
    const output = await runPackaging(input, ctx);

    expect(output.prompts.map((prompt) => prompt.prompt).join(" ")).toContain("No wet mess");
    expect(() => assertOutput(output)).not.toThrow();
  });

  it("keeps local preference low-confidence when competitor evidence is missing", async () => {
    const ctx = createContext(createSpyImageProvider(), createNoopRisk());
    const input = await buildPackagingInput(ctx, {
      imageMode: "dry-run",
      competitorSignals: [],
      policyRules: [],
      riskWarnings: [],
    });
    const output = await runPackaging(input, ctx);

    expect(output.preference_profile.visual_style).toContain("No competitor visual style evidence supplied");
    expect(output.preference_profile.local_scene_cues.join(" ").toLowerCase()).toContain("hdb");
    expect(output.preference_profile.local_scene_cues.join(" ").toLowerCase()).toContain("home office");
    expect(output.preference_profile.confidence).toBeLessThan(0.75);
    expect(output.preference_profile.needs_human_review).toBe(true);
    expect(output.agent.warnings).toContain("Preference research has limited evidence or missing product proof; human review required.");
  });

  it("exposes tool-backed preference research tools for live packaging agents", () => {
    const tools = createPackagingTools(createSpyImageProvider()).map((tool) => tool.name);

    expect(tools).toEqual(
      expect.arrayContaining([
        "extract_competitor_style",
        "extract_product_facts",
        "extract_policy_constraints",
        "generate_product_image",
        "edit_product_image",
        "check_image_compliance",
      ]),
    );
  });

  it("live mode uses edit provider for source images and keeps generated review status", async () => {
    const openaiImage = createLiveSpyImageProvider();
    const ctx = createContext(openaiImage, createNoopRisk());

    const result = await runPackagingAgent(ctx, {
      imageMode: "live",
      runId: "run_source_image",
      sourceImage: "https://example.com/private/source.png?signature=secret",
    });

    expect(openaiImage.editProductImage).toHaveBeenCalledTimes(3);
    expect(openaiImage.generateProductImage).not.toHaveBeenCalled();
    expect(result.selected_listing?.images.every((image) => image.compliance === "needs_review")).toBe(true);
  });
});

function createContext(openaiImage: OpenAIImageProvider, risk: RiskSupervisor = createNoopRisk()): AgentContext {
  const result = mockResult as RunResult;
  return {
    brief: result.brief,
    results: result,
    providers: {
      shopee: createSeedShopeeProvider(),
      sourcing1688: createSeedSourcing1688Provider(),
      shipping: createSeedShippingProvider(),
      fx: createSeedFxProvider(),
      openaiImage,
    },
    risk,
  };
}

function createSpyImageProvider(): OpenAIImageProvider {
  return {
    generateProductImage: vi.fn(async () => {
      throw new Error("generateProductImage should not be called in dry-run mode");
    }),
    editProductImage: vi.fn(async () => {
      throw new Error("editProductImage should not be called in dry-run mode");
    }),
    checkImageCompliance: vi.fn(async ({ imageUrl, prompt }) => {
      const status: ImageComplianceStatus = prompt.toLowerCase().includes("feature") ? "needs_review" : "ok";
      return {
        source: {
          provider: "openai-image",
          mode: "seed" as const,
          captured_at: "2026-06-06T00:00:00+08:00",
        },
        image_url: imageUrl,
        status,
        notes: ["test compliance"],
        flags: [],
      };
    }),
  };
}

function createLiveSpyImageProvider(): OpenAIImageProvider {
  return {
    generateProductImage: vi.fn(async () => {
      throw new Error("generateProductImage should not be called when sourceImage is provided");
    }),
    editProductImage: vi.fn(async ({ prompt, constraints }) => ({
      source: {
        provider: "openai-image",
        mode: "live" as const,
        captured_at: "2026-06-06T00:00:00+08:00",
      },
      image: {
        image_id: `edited-${constraints?.asset_type ?? "hero"}`,
        type: constraints?.asset_type ?? "hero",
        url: `/generated/run_source_image/${constraints?.asset_type ?? "hero"}.jpg`,
        prompt,
        model: "gpt-image-2",
        size: "1024x1024",
        quality: "low",
        compliance: "needs_review" as const,
        metadata: { provider_mode: "live" },
      },
    })),
    checkImageCompliance: vi.fn(async ({ imageUrl, prompt }) => ({
      source: {
        provider: "openai-image",
        mode: "live" as const,
        captured_at: "2026-06-06T00:00:00+08:00",
      },
      image_url: imageUrl,
      status: (prompt.toLowerCase().includes("feature") ? "needs_review" : "ok") as ImageComplianceStatus,
      notes: ["test compliance"],
      flags: [],
    })),
  };
}

function createSpyRisk(): RiskSupervisor {
  const checkpoint: RiskCheckpoint = {
    stage: "packaging",
    risk_level: "medium",
    human_review_required: true,
    hard_block: false,
    warnings: ["Packaging feature image requires human review."],
    evidence: [{ label: "Packaging checkpoint", value: "called" }],
    flags: [],
  };

  return {
    checkpoint: vi.fn(async () => checkpoint),
    getCheckpoints: vi.fn(() => [checkpoint]),
  };
}
