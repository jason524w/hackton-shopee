import { validateJsonSchema } from "../../agent-runtime/schemas";
import type { AgentContext } from "../contracts";
import { replayFixture as replayMarketFixture } from "../market/harness";
import { runSourcingAgent } from "./index";
import { sourcingOutputSchema, type SourcingOutput } from "./schema";

export async function replayFixture(ctx: AgentContext): Promise<SourcingOutput> {
  const market = await replayMarketFixture(ctx);
  const primary = market.directions.find((direction) => direction.id === market.primary_direction_id);
  if (!primary) {
    throw new Error(`Primary market direction not found: ${market.primary_direction_id}`);
  }

  return runSourcingAgent({ brief: ctx.brief, primary_direction: primary }, ctx, { mode: "fixture" });
}

export function assertOutput(output: SourcingOutput, maxFulfillmentDays: number): void {
  const validation = validateJsonSchema(sourcingOutputSchema, output);
  if (!validation.valid) {
    throw new Error(`Sourcing output schema failed: ${validation.errors.join("; ")}`);
  }

  if (output.source_price_sgd <= 0) {
    throw new Error("Expected source_price_sgd > 0");
  }

  if (output.selected_supplier.moq <= 0) {
    throw new Error("Expected MOQ to be present");
  }

  if (output.selected_supplier.available_stock <= 0) {
    throw new Error("Expected available stock to be present");
  }

  if (output.package_weight_g <= 0) {
    throw new Error("Expected package weight to be present");
  }

  const dimensions = output.package_dimensions_cm;
  if (dimensions.length <= 0 || dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error(`Expected package dimensions to be present: ${JSON.stringify(dimensions)}`);
  }

  if (output.fulfillment_days <= 0) {
    throw new Error("Expected fulfillment days to be present");
  }

  if (
    (output.fulfillment_days >= maxFulfillmentDays || output.shipping.high.days_max > maxFulfillmentDays) &&
    output.warnings.length === 0
  ) {
    throw new Error("Expected fulfillment warning when base or high scenario reaches/exceeds seller max");
  }

  const tools = new Set(output.tool_snapshots.map((snapshot) => snapshot.tool_name));
  for (const toolName of ["sourcing_search_offers", "sourcing_get_offer_detail", "fx_convert", "shipping_estimate_cross_border"]) {
    if (!tools.has(toolName)) {
      throw new Error(`Expected tool snapshot for ${toolName}`);
    }
  }
}

