import mockResult from "../../../contract/mock-result.json";
import type { RunResult } from "../../../contract/result";
import { AFFIRMATIVE_PROMPT_REVIEW_TERMS } from "../../compliance/claims";
import { createNoopRisk, type AgentContext } from "../contracts";
import {
  createSeedFxProvider,
  createSeedOpenAIImageProvider,
  createSeedShippingProvider,
  createSeedShopeeProvider,
  createSeedSourcing1688Provider,
} from "../../providers";
import { runPackaging, type RunPackagingAgentOptions, buildPackagingInput } from "./index";
import type { PackagingOutput } from "./schema";

export async function replayFixture(options: RunPackagingAgentOptions = {}): Promise<PackagingOutput> {
  const ctx = createFixtureContext();
  const input = await buildPackagingInput(ctx, {
    imageMode: "dry-run",
    runId: "run_packaging_fixture",
    ...options,
  });
  return runPackaging(input, ctx);
}

export function assertOutput(output: PackagingOutput): void {
  const types = output.images.map((image) => image.type).sort().join(",");
  if (types !== "feature,hero,lifestyle") {
    throw new Error(`Packaging output must include exactly hero/lifestyle/feature images, got ${types}`);
  }

  for (const prompt of output.prompts) {
    const normalized = prompt.prompt.toLowerCase();
    for (const term of AFFIRMATIVE_PROMPT_REVIEW_TERMS) {
      if (containsAffirmativePromptTerm(normalized, term)) {
        throw new Error(`Packaging prompt includes banned term "${term}"`);
      }
    }
  }

  if (!output.preference_profile.local_scene_cues.length) {
    throw new Error("Packaging preference profile must include local scene cues backed by listing or competitor evidence.");
  }

  if (!output.preference_profile.evidence_items.length) {
    throw new Error("Packaging preference profile must include auditable evidence items.");
  }

  if (!output.preference_profile.title_pattern.rationale_evidence_ids.length) {
    throw new Error("Packaging title pattern must reference preference evidence ids.");
  }

  for (const prompt of output.prompts) {
    if (!prompt.constraints.product_attributes.length) {
      throw new Error(`Packaging ${prompt.type} prompt must include grounded product attributes.`);
    }
  }

  if (!output.compliance.human_review_required) {
    throw new Error("Mini Desk Vacuum packaging should require human review for image/spec checks.");
  }
}

function containsAffirmativePromptTerm(normalizedPrompt: string, term: string): boolean {
  const normalizedTerm = term.toLowerCase();
  let index = normalizedPrompt.indexOf(normalizedTerm);

  while (index >= 0) {
    const prefix = normalizedPrompt.slice(Math.max(0, index - 32), index);
    if (!/\b(no|not|without|avoid|unsupported)\s+$/i.test(prefix)) {
      return true;
    }
    index = normalizedPrompt.indexOf(normalizedTerm, index + normalizedTerm.length);
  }

  return false;
}

function createFixtureContext(): AgentContext {
  const result = mockResult as RunResult;
  return {
    brief: result.brief,
    results: result,
    providers: {
      shopee: createSeedShopeeProvider(),
      sourcing1688: createSeedSourcing1688Provider(),
      shipping: createSeedShippingProvider(),
      fx: createSeedFxProvider(),
      openaiImage: createSeedOpenAIImageProvider(),
    },
    risk: createNoopRisk(),
  };
}
