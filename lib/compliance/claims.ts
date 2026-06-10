// Single source of truth for banned / unsupported product claims across the pipeline.
// Previously three drifting lists existed (risk/claims.ts with "industrial-grade",
// listing's inline list with "industrial grade", and this file) — they are now
// consolidated here. risk and listing import from this module; matching is
// hyphen/space-insensitive and word-boundary-aware so e.g. "certified" does NOT
// false-positive inside "uncertified". See docs/design/margin-risk.md §7 and the
// 2026-06-10 code review (claims dedup).

// Buyer-facing performance / authenticity / safety claims that must not appear in
// generated copy or image prompts unless backed by verifiable supplier proof.
// Terms are stored in their canonical space-separated form; the matcher treats a
// hyphen the same as a space, so "industrial grade" also catches "industrial-grade".
export const UNSUPPORTED_PRODUCT_CLAIMS = [
  "super suction",
  "strong suction",
  "strongest suction",
  "industrial grade",
  "medical grade",
  "certified safe",
  "safety certified",
  "guaranteed deep clean",
  "guaranteed deep cleaning",
  "hepa",
  "kills germs",
  "removes mites",
  "waterproof",
  "wet and dry",
  "wet mess",
  "floor cleaner",
  "car vacuum",
  "sofa vacuum",
  "official",
  "local stock",
  "local warranty",
  "fda approved",
  "100% genuine",
  "ce",
  "ul",
  "psb",
  // Chinese demo-load-bearing terms (risk deterministic layer).
  "超强吸力",
  "工业级",
];

// A stricter subset that should always trigger human review when present in an
// affirmative image prompt (packaging harness).
export const AFFIRMATIVE_PROMPT_REVIEW_TERMS = [
  "super suction",
  "industrial grade",
  "certified safe",
  "wet mess",
];

// Claims the risk deterministic layer flags as exaggerated/unverifiable. This is a
// superset view assembled from UNSUPPORTED_PRODUCT_CLAIMS plus a couple of
// risk-specific authenticity terms; kept as a named export so risk/claims.ts can
// re-export it and existing imports keep working.
export const BANNED_CLAIM_TERMS: string[] = [
  "super suction",
  "strongest suction",
  "industrial grade",
  "guaranteed deep clean",
  "medical grade",
  "certified",
  "fda approved",
  "100% genuine",
  "超强吸力",
  "工业级",
];

/** Normalize for matching: lowercase, treat hyphen/underscore/slash as space, collapse whitespace. */
export function normalizeClaimText(value: string): string {
  return value.toLowerCase().replace(/[-_/]+/g, " ").replace(/\s+/g, " ").trim();
}

const HAS_WORD_CHAR = /[a-z0-9]/i;

/**
 * Whether `normalizedText` contains `term` as a whole, hyphen/space-insensitive match.
 * For ASCII terms we require word boundaries so short terms ("certified", "ce", "ul")
 * do not match inside larger words ("uncertified", "centre", "ultra"). CJK terms have
 * no word boundaries, so we fall back to substring containment for those.
 */
export function claimMatches(normalizedText: string, term: string): boolean {
  const normalizedTerm = normalizeClaimText(term);
  if (!normalizedTerm) {
    return false;
  }
  const isAscii = /^[\x00-\x7f]+$/.test(normalizedTerm);
  if (!isAscii) {
    return normalizedText.includes(normalizedTerm);
  }
  // Word-boundary-aware: only require boundaries on sides that begin/end with a word char.
  const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const left = HAS_WORD_CHAR.test(normalizedTerm[0] ?? "") ? "\\b" : "";
  const right = HAS_WORD_CHAR.test(normalizedTerm[normalizedTerm.length - 1] ?? "") ? "\\b" : "";
  return new RegExp(`${left}${escaped}${right}`, "i").test(normalizedText);
}
