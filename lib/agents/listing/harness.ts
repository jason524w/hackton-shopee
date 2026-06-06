import mockResult from "../../../contract/fixtures/sample-result.json";
import type { RunResult } from "../../../contract/result";
import {
  createSeedBrowserRetrievalProvider,
  createSeedFxProvider,
  createSeedOpenAIImageProvider,
  createSeedShippingProvider,
  createSeedShopeeProvider,
  createSeedSourcing1688Provider,
} from "../../providers";
import { createNoopRisk, type AgentContext } from "../contracts";
import { buildListingInput, runListing, type RunListingAgentOptions } from "./index";
import type { ListingOutput } from "./schema";

const BANNED_TERMS = ["super suction", "industrial grade", "certified safety", "guaranteed deep cleaning"];

export async function replayFixture(options: RunListingAgentOptions = {}): Promise<ListingOutput> {
  const ctx = createFixtureContext();
  const input = await buildListingInput(ctx, {
    runId: "run_listing_fixture",
    mode: "fixture",
    ...options,
  });
  return runListing(input, ctx, options);
}

export function assertOutput(output: ListingOutput): void {
  if (!output.selection.ranked_ids.length) {
    throw new Error("Listing Ranker must return ranked opportunity ids.");
  }

  if (output.selected_listing.opportunity_id !== output.selection.selected_opportunity_id) {
    throw new Error("Selected listing handoff must match selected opportunity.");
  }

  if (output.selected_listing.images.length) {
    throw new Error("Listing Ranker must not generate Packaging-owned images.");
  }

  const listingText = [
    output.selected_listing.shopee.item_name,
    output.selected_listing.shopee.description,
    ...output.selected_listing.shopee.bullet_points,
  ]
    .join(" ")
    .toLowerCase();
  for (const term of BANNED_TERMS) {
    if (listingText.includes(term)) {
      throw new Error(`Listing handoff includes banned claim "${term}".`);
    }
  }
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
      browser: createSeedBrowserRetrievalProvider(),
    },
    risk: createNoopRisk(),
  };
}
