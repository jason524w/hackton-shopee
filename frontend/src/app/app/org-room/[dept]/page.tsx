"use client";

import { use } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DEPARTMENTS } from "@/lib/mock-data";
import { StatusText } from "@/components/primitives/status";

export default function DeptDetailPage({
  params,
}: {
  params: Promise<{ dept: string }>;
}) {
  const { dept } = use(params);
  const d = DEPARTMENTS.find((x) => x.id === dept);
  if (!d) notFound();

  return (
    <div className="grid min-h-[70vh] grid-cols-[1fr_2fr_1fr]">
      {/* Left: dept list */}
      <div className="border-r hairline bg-ivory px-6 py-6">
        <Link
          href="/app/org-room"
          className="mb-5 inline-block font-mono text-[11px] text-orange transition-colors hover:text-ink"
        >
          ← Back to Org Room
        </Link>
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-4">
          Departments
        </p>
        {DEPARTMENTS.map((x) => (
          <Link
            key={x.id}
            href={`/app/org-room/${x.id}`}
            className={`block py-2 font-display text-sm ${
              x.id === d.id ? "font-semibold text-orange" : "text-ink-soft"
            }`}
          >
            {x.shortName}
          </Link>
        ))}
      </div>

      {/* Middle: result */}
      <div className="px-9 py-6">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="font-display text-[28px] font-black tracking-tight text-ink">
            {d.department}
          </h1>
          <StatusText status={d.status} />
        </div>
        <p className="font-display text-base font-light italic text-ink-soft mb-6">
          {d.question}
        </p>

        <Section title="Mission">{d.mission}</Section>
        <Section title="Key finding">{d.keyFinding}</Section>
        <Section title="Reasoning">{d.reasoning}</Section>

        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-orange mt-6 mb-2">
          Output fields
        </p>
        {d.outputPreview.map((o) => (
          <div key={o.label} className="flex gap-3 border-b hairline py-1.5">
            <span className="font-mono text-[11px] text-ink-faint w-40 shrink-0">
              {o.label}
            </span>
            <span className="text-[12px] text-ink">{o.value}</span>
          </div>
        ))}
      </div>

      {/* Right: evidence */}
      <div className="border-l hairline bg-surface px-6 py-6">
        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint mb-3">
          Evidence
        </p>
        {d.evidence.map((e, i) => (
          <div key={i} className="flex gap-2 border-b hairline py-2 items-baseline">
            <span className="font-mono text-[11px] text-orange">{String(i + 1).padStart(2, "0")}</span>
            <span className="text-[12px] leading-snug text-ink-soft">{e}</span>
          </div>
        ))}

        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint mt-5 mb-2">
          Confidence
        </p>
        <p className="font-display text-3xl font-black text-ink">{d.score}<span className="text-ink-faint text-lg">/100</span></p>

        {d.warnings.length > 0 && (
          <>
            <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-watch mt-5 mb-2">
              Warnings
            </p>
            {d.warnings.map((w) => (
              <p key={w} className="text-[12px] text-watch leading-snug mb-1">⚠ {w}</p>
            ))}
          </>
        )}

        <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint mt-5 mb-2">
          Impact on Committee
        </p>
        <p className="text-[12px] leading-snug text-ink-soft">{d.impactOnCommittee}</p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <p className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-orange mb-1">
        {title}
      </p>
      <p className="text-[13px] leading-relaxed text-ink-soft">{children}</p>
    </div>
  );
}
