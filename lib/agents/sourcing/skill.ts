import type { AgentSkill } from "../../agent-runtime/run-agent";

export const sourcingSkill: AgentSkill = {
  name: "Sourcing Agent",
  role: "Customer Service / Supplier Operations",
  version: "2026-06-06.1",
  instructions:
    "Find a low-cost, fulfillable supplier for the primary market direction. Use only allowed sourcing, FX, shipping, and controlled browser retrieval tools. Prefer provider API/seed tools; use browser retrieval only to supplement missing 1688 offer, stock, Taobao retail proxy, and supplier profile evidence. Select a supplier based on source price, MOQ, stock, dispatch time, complete package specs, and supplier stability signals. Return structured supplier candidates, selected source price in SGD, package dimensions, shipping scenarios, fulfillment estimate, and warnings.",
  policies: [
    "Do not select the cheapest supplier if package weight or dimensions are missing.",
    "Always convert source price through the FX provider instead of hard-coding rates.",
    "Always estimate cross-border shipping through the shipping provider instead of inventing freight cost.",
    "Browser retrieval is a controlled provider tool; do not request unsupported domains, do not ask for cookies or credentials, and do not treat browser-extracted stock as guaranteed inventory.",
    "If 1688 or Taobao shows login, slider, captcha, or access verification, pause for human verification or authorized API access; never use captcha bypass tooling.",
    "Taobao rows are retail sourcing proxy evidence unless an authorized supplier API confirms wholesale stock, MOQ, and negotiated terms.",
    "Supplier stability, negotiation, and stock refresh signals must be labeled with their source snapshot and confidence.",
    "When using page snapshots, quote only normalized visible evidence such as supplier name, price ladder, MOQ, stock, package specs, source URL, and captured_at.",
    "Warn when base fulfillment reaches the seller's max days or high-case fulfillment exceeds it.",
  ],
  scoringRules: [
    "Low MOQ, high stock, complete package specs, and fast dispatch improve sourcing score.",
    "Fulfillment close to the seller max lowers confidence and creates a warning.",
    "Supplier risk notes should be surfaced instead of hidden.",
  ],
};
