"use client";

import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { weightLabel } from "@/lib/adapters";
import { DecisionChip } from "@/components/primitives/status";

export default function CommitteePage() {
  const committee = useAppStore((s) => s.committee);
  const runStatus = useAppStore((s) => s.runStatus);

  // Empty / loading state: no live committee output yet.
  if (!committee) {
    return (
      <div className="px-14 py-7">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-2">
          Committee Decision
        </p>
        <h1 className="font-display text-[34px] font-black tracking-tight text-ink mb-2">
          {runStatus === "running" ? "Committee is deliberating…" : "No committee verdict yet."}
        </h1>
        <p className="font-display text-[15px] font-light italic text-ink-faint">
          {runStatus === "running"
            ? "Departments are still reporting in — the verdict appears once the run finishes."
            : "Run a brief first — the committee renders its real Go / Watch / Reject call here."}
        </p>
        <Link href="/app/brief" className="font-mono text-[11px] text-orange mt-4 inline-block">
          ← Start from a brief
        </Link>
      </div>
    );
  }

  return (
    <div className="px-14 py-7">
      {/* Decision card */}
      <div className="mb-8 flex items-end justify-between border-b hairline pb-6">
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-2">
            Committee Decision
          </p>
          <div className="flex items-center gap-4">
            <DecisionChip decision={committee.decision} />
            <span className="font-display text-2xl font-black text-ink">
              Confidence {committee.confidence}%
            </span>
          </div>
          {committee.summary && (
            <p className="font-display text-base font-light italic text-ink-soft mt-2 max-w-3xl">
              {committee.summary}
            </p>
          )}
          <p className="font-display text-[13px] font-light text-ink-faint mt-2">
            Recommended next action: {committee.recommendedAction}
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
          {committee.scoreMatrix.map((m) => (
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
          {committee.tradeoffs.length === 0 ? (
            <p className="font-display text-[13px] font-light italic text-ink-faint py-2">
              No conflicts flagged across the surfaced opportunities.
            </p>
          ) : (
            committee.tradeoffs.map((t, i) => (
              <div
                key={`${t.product}-${i}`}
                className="flex gap-4 border-t hairline py-2.5 last:border-b"
              >
                <span className="text-[12px] text-ink w-72 shrink-0">
                  <span className="font-semibold">{t.product}</span> — {t.conflict}
                </span>
                <span className="font-display text-[12px] font-light italic text-ink-soft">
                  {t.resolution}
                </span>
              </div>
            ))
          )}
        </div>

        {/* Weights */}
        <div>
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-3">
            Recommendation weights
          </p>
          {committee.weights.map((w) => (
            <div key={w.dimension} className="border-t hairline py-3 last:border-b">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-[12px] text-ink">{weightLabel(w.dimension)}</span>
                <span className="font-mono text-[12px] font-semibold text-orange">{w.label}</span>
              </div>
              <div className="h-1 w-full bg-ivory-deep">
                <div className="h-full bg-orange" style={{ width: w.label }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
