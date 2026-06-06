"use client";

import Link from "next/link";
import { DEPARTMENTS } from "@/lib/mock-data";
import { DecisionChip } from "@/components/primitives/status";

const MATRIX = DEPARTMENTS.filter((d) => d.id !== "committee").map((d) => ({
  name: d.department,
  score: d.score,
  finding: d.keyFinding,
  state:
    d.id === "risk" ? "Warning" : d.id === "listing" ? "Ready" : "Positive",
}));

const CONFLICTS = [
  ["High demand + low margin", "Watch — find cheaper sourcing or differentiate"],
  ["High profit + high risk", "Reject or Human Review"],
  ["Low-cost source + long fulfillment", "Watch — change supplier or adjust promise"],
  ["Complete fields + compliance warning", "Human Review — not auto-approved"],
  ["Medium profit + low risk + stable source", "Go"],
];

const WEIGHTS = [
  ["Profit viability", "30%"],
  ["Market demand", "25%"],
  ["Compliance risk", "20%"],
  ["Fulfillment feasibility", "15%"],
  ["Listing readiness", "10%"],
];

export default function CommitteePage() {
  return (
    <div className="px-14 py-7">
      {/* Decision card */}
      <div className="mb-8 flex items-end justify-between border-b hairline pb-6">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-2">
            Committee Decision
          </p>
          <div className="flex items-center gap-4">
            <DecisionChip decision="go" />
            <span className="font-display text-2xl font-black text-ink">
              Confidence 82%
            </span>
          </div>
          <p className="font-display text-base font-light italic text-ink-soft mt-2">
            Recommended next action: select for Packaging Studio.
          </p>
        </div>
        <Link
          href="/app/board"
          className="bg-orange px-5 py-2.5 font-display text-sm font-black text-white"
        >
          View Opportunity Board →
        </Link>
      </div>

      <div className="grid grid-cols-[2fr_1fr] gap-12">
        {/* Score matrix */}
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-3">
            Department Scores
          </p>
          {MATRIX.map((m) => (
            <div
              key={m.name}
              className="flex items-center gap-4 border-t hairline py-3 last:border-b"
            >
              <span className="font-display text-base font-semibold text-ink w-48 shrink-0">
                {m.name}
              </span>
              <span className="font-display text-2xl font-black text-ink w-14">
                {m.score}
              </span>
              <span
                className={`font-mono text-[11px] font-semibold w-20 ${
                  m.state === "Warning" ? "text-watch" : "text-go"
                }`}
              >
                {m.state}
              </span>
              <span className="font-display text-[12px] font-light italic text-ink-soft flex-1">
                {m.finding}
              </span>
            </div>
          ))}

          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mt-8 mb-3">
            Conflict resolution
          </p>
          {CONFLICTS.map(([scenario, outcome]) => (
            <div key={scenario} className="flex gap-4 border-t hairline py-2.5 last:border-b">
              <span className="text-[12px] text-ink w-72 shrink-0">{scenario}</span>
              <span className="font-display text-[12px] font-light italic text-ink-soft">
                {outcome}
              </span>
            </div>
          ))}
        </div>

        {/* Weights */}
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-3">
            Recommendation weights
          </p>
          {WEIGHTS.map(([dim, w]) => (
            <div key={dim} className="border-t hairline py-3 last:border-b">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[12px] text-ink">{dim}</span>
                <span className="font-mono text-[12px] font-semibold text-orange">{w}</span>
              </div>
              <div className="h-1 w-full bg-ivory-deep">
                <div className="h-full bg-orange" style={{ width: w }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
