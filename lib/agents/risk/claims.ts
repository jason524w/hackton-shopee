// Exaggerated / unverifiable claim matcher. Deterministic, demo-load-bearing:
// "super suction" etc. MUST be caught here, never relying on the LLM.
// Shared by the listing (text) and packaging (image prompt) checkpoints.

export interface ClaimHit {
  term: string;
  matched: string; // the surrounding snippet, for evidence
}

// Banned performance / authenticity claims. Sources: Shopee SG listing-violation
// guide (seed policy-rules) + Amazon compliance keyword lists. See docs/design/margin-risk.md §7.
export const BANNED_CLAIM_TERMS: string[] = [
  "super suction",
  "industrial-grade",
  "guaranteed deep clean",
  "strongest suction",
  "medical grade",
  "certified",
  "fda approved",
  "100% genuine",
  "超强吸力",
  "工业级",
];

export function findBannedClaims(
  text: string,
  terms: string[] = BANNED_CLAIM_TERMS,
): ClaimHit[] {
  if (!text) return [];
  const haystack = text.toLowerCase();
  const hits: ClaimHit[] = [];
  for (const term of terms) {
    const idx = haystack.indexOf(term.toLowerCase());
    if (idx >= 0) {
      const start = Math.max(0, idx - 12);
      const end = Math.min(text.length, idx + term.length + 12);
      hits.push({ term, matched: text.slice(start, end).trim() });
    }
  }
  return hits;
}
