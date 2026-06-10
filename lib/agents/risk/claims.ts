// Exaggerated / unverifiable claim matcher. Deterministic, demo-load-bearing:
// "super suction" etc. MUST be caught here, never relying on the LLM.
// Shared by the listing (text) and packaging (image prompt) checkpoints.
//
// The term list now lives in lib/compliance/claims.ts (single source of truth).
// Matching is normalized (hyphen == space) and word-boundary-aware to avoid
// substring false-positives like "certified" matching "uncertified".

import {
  BANNED_CLAIM_TERMS,
  claimMatches,
  normalizeClaimText,
} from "../../compliance/claims";

export { BANNED_CLAIM_TERMS } from "../../compliance/claims";

export interface ClaimHit {
  term: string;
  matched: string; // the surrounding snippet, for evidence
}

export function findBannedClaims(
  text: string,
  terms: string[] = BANNED_CLAIM_TERMS,
): ClaimHit[] {
  if (!text) return [];
  const normalizedHaystack = normalizeClaimText(text);
  const lowerText = text.toLowerCase();
  const hits: ClaimHit[] = [];
  for (const term of terms) {
    if (!claimMatches(normalizedHaystack, term)) {
      continue;
    }
    // Best-effort snippet for evidence: locate the (normalized) term in the raw text.
    const probe = term.toLowerCase();
    const idx = lowerText.indexOf(probe);
    if (idx >= 0) {
      const start = Math.max(0, idx - 12);
      const end = Math.min(text.length, idx + probe.length + 12);
      hits.push({ term, matched: text.slice(start, end).trim() });
    } else {
      // Hyphen/spacing variant matched (e.g. term "industrial grade" vs text "industrial-grade").
      hits.push({ term, matched: text.trim().slice(0, 48) });
    }
  }
  return hits;
}
