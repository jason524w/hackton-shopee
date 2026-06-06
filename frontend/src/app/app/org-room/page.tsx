"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Link from "next/link";
import { DEPARTMENTS } from "@/lib/mock-data";
import { StatusText } from "@/components/primitives/status";
import type { DeptStatus } from "@/lib/types";

const ORDER = DEPARTMENTS.map((d) => d.id);

export default function OrgRoomPage() {
  const router = useRouter();
  // Simulate sequential completion: index of the dept currently running.
  const [runningIndex, setRunningIndex] = useState(0);

  useEffect(() => {
    if (runningIndex >= ORDER.length) return;
    const t = setTimeout(() => setRunningIndex((i) => i + 1), 1100);
    return () => clearTimeout(t);
  }, [runningIndex]);

  function statusFor(i: number): DeptStatus {
    if (i < runningIndex) return "complete";
    if (i === runningIndex) return "running";
    return "waiting";
  }

  const allDone = runningIndex >= ORDER.length;
  const completed = DEPARTMENTS.filter((_, i) => statusFor(i) === "complete");

  return (
    <div className="grid min-h-[70vh] grid-cols-[2fr_3fr]">
      {/* Left: department list */}
      <div className="border-r hairline bg-ivory px-8 py-7">
        <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-5">
          AI Commerce Company
        </p>
        {DEPARTMENTS.map((d, i) => (
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
                statusFor(i) === "running" ? "text-orange" : "text-ink"
              }`}
            >
              {d.shortName}
            </span>
            <StatusText status={statusFor(i)} />
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
              {d.outputPreview.map((o) => `${o.label}: ${o.value}`).join(" · ")} · score:{" "}
              {d.score}
            </p>
          </motion.div>
        ))}

        {!allDone && (
          <div className="py-3 opacity-50">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-ink-faint mb-1">
              {DEPARTMENTS[runningIndex]?.department} · Running…
            </p>
            <p className="font-display text-[15px] font-light italic text-ink-faint">
              Analyzing…
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
