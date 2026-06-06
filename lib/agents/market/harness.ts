import { validateJsonSchema } from "../../agent-runtime/schemas";
import type { AgentContext } from "../contracts";
import { runMarketAgent } from "./index";
import { marketOutputSchema, type MarketOutput } from "./schema";

const FAKE_SALES_CLAIMS = /\b(monthly sales|true sales|actual sales|units sold per month|sales volume)\b/i;

export async function replayFixture(ctx: AgentContext): Promise<MarketOutput> {
  return runMarketAgent({ brief: ctx.brief }, ctx, { mode: "fixture" });
}

export function assertOutput(output: MarketOutput): void {
  const validation = validateJsonSchema(marketOutputSchema, output);
  if (!validation.valid) {
    throw new Error(`Market output schema failed: ${validation.errors.join("; ")}`);
  }

  if (output.directions.length !== 3) {
    throw new Error(`Expected exactly 3 market directions, got ${output.directions.length}`);
  }

  if (output.primary_direction_id !== "opp_desk_vacuum") {
    throw new Error(`Expected stable primary direction opp_desk_vacuum, got ${output.primary_direction_id}`);
  }

  if (output.competitor_count <= 0) {
    throw new Error("Expected competitor_count > 0");
  }

  if (output.price_band.low <= 0 || output.price_band.high < output.price_band.low) {
    throw new Error(`Invalid price band: ${JSON.stringify(output.price_band)}`);
  }

  if (output.tool_snapshots.length === 0 || output.tool_snapshots.some((snapshot) => !snapshot.fixture_id)) {
    throw new Error("Expected every market tool snapshot to carry source metadata");
  }

  if (FAKE_SALES_CLAIMS.test(output.agent_result.key_judgment)) {
    throw new Error(`Market key_judgment contains a fake sales claim: ${output.agent_result.key_judgment}`);
  }
}

