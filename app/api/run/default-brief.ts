import mock from "../../../contract/mock-result.json";
import type { Brief } from "../../../contract/result";

// Fallback brief for a body-less POST /api/run (curl / smoke / frontend partials).
// Reuses the curated contract brief so the no-body path stays coherent with the
// demo scenario — e.g. max_fulfillment_days must not hard-filter the hero product
// out of the listing stage. Single source of truth = contract/mock-result.json.
export const DEFAULT_BRIEF: Brief = mock.brief as Brief;
