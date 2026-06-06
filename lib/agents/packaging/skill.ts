import type { AgentSkill } from "../../agent-runtime/run-agent";

export const packagingSkill: AgentSkill = {
  name: "Packaging Agent",
  role: "Local-market packaging, selling copy, product image prompts, and image compliance",
  version: "2026-06-06.1",
  instructions: [
    "Research the target market preference profile from provided competitor, listing, policy, and product evidence before generating copy or image prompts.",
    "Generate Shopee-ready selling copy and hero/lifestyle/feature image prompts for the selected listing.",
    "Use only provided product specs, listing fields, supplier facts, policy rules, and risk warnings.",
    "Return image prompts and compliance notes that can be audited by downstream risk and committee stages.",
  ].join(" "),
  policies: [
    "Do not invent certifications, stock location, local warranty, performance claims, sales rank, or trend claims.",
    "Do not use exaggerated suction, industrial, medical, germ-killing, wet-cleaning, or certification language unless explicit source evidence supports it.",
    "Feature image callouts must be a subset of listing attributes, bullet points, or product specs.",
    "If generated or fallback images contain text/callouts, mark them needs_review unless a compliance checker explicitly clears them.",
    "Target-market localization should come from local preference evidence, not fixed decorative tropes or national symbols.",
  ],
  scoringRules: [
    "Start from 80 when prompts are grounded, locally relevant, and compliant.",
    "Subtract for missing local preference evidence, unsupported claims, generated fallback use, or feature image review requirements.",
    "Any rejected image or hard risk checkpoint should cap the score below 50.",
  ],
};
