"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { StatusText } from "@/components/primitives/status";

export default function OrgRoomPage() {
  const router = useRouter();
  const departments = useAppStore((s) => s.departments);
  const runStatus = useAppStore((s) => s.runStatus);
  const runError = useAppStore((s) => s.runError);

  // Only stream departments that have actually reported content. During audit
  // polling a department can be flagged "complete" before its real finding lands
  // (that only arrives with the final POST result), which would render half-empty
  // "· score: 0" rows.
  const completed = departments.filter(
    (d) => d.status === "complete" && (d.keyFinding || d.outputPreview.length > 0),
  );
  const allDone = runStatus === "done";

  return (
    <div className="grid min-h-[70vh] grid-cols-[2fr_3fr]">
      {/* Left: department list */}
      <div className="border-r hairline bg-ivory px-8 py-7">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-5">
          AI Commerce Company
        </p>
        {departments.map((d, i) => (
          <Link
            key={d.id}
            href={`/app/org-room/${d.id}`}
            className="flex items-baseline gap-3 border-t hairline py-2.5 last:border-b"
          >
            <span className="font-mono text-[11px] text-ink-faint w-5">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span
              className={`font-display text-base font-semibold flex-1 ${
                d.status === "running" ? "text-orange" : "text-ink"
              }`}
            >
              {d.shortName}
            </span>
            <StatusText status={d.status} />
          </Link>
        ))}
      </div>

      {/* Right: output stream */}
      <div className="bg-surface px-9 py-7">
        <div className="flex items-center justify-between mb-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
            Department Output Stream
          </p>
          {allDone && (
            <button
              onClick={() => router.push("/app/board")}
              className="bg-orange px-4 py-2 font-display text-xs font-black text-white"
            >
              View Opportunity Board →
            </button>
          )}
        </div>

        {runStatus === "idle" && (
          <p className="py-3 font-display text-[15px] font-light italic text-ink-faint">
            No run yet — submit a brief to put the company to work.
          </p>
        )}

        {runStatus === "error" && (
          <div className="py-3">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-red-600 mb-1">
              Pipeline Error
            </p>
            <p className="font-display text-[15px] font-light italic text-ink-soft">{runError}</p>
          </div>
        )}

        {completed.map((d) => (
          <motion.div
            key={d.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="border-b hairline py-3"
          >
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-orange mb-1">
              {d.department} · Complete
            </p>
            <p className="font-display text-[15px] font-light italic text-ink-soft leading-snug">
              {d.keyFinding}
            </p>
            <p className="font-mono text-[11px] text-ink-faint mt-1">
              {d.outputPreview.length > 0 &&
                `${d.outputPreview.map((o) => `${o.label}: ${o.value}`).join(" · ")} · `}
              score: {d.score}
            </p>
          </motion.div>
        ))}

        {runStatus === "running" && (
          <div className="py-3 opacity-50">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint mb-1">
              Live pipeline running…
            </p>
            <p className="font-display text-[15px] font-light italic text-ink-faint">
              Analyzing market, sourcing, margin, risk, listing, packaging…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
