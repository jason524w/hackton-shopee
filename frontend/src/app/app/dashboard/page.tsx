"use client";

import { CountUp } from "@/components/primitives/count-up";
import { BOARD_SUMMARY } from "@/lib/mock-data";

const METRICS = [
  { value: BOARD_SUMMARY.found, label: "opportunities found" },
  { value: BOARD_SUMMARY.go, label: "Go decisions" },
  { value: 1, label: "launch packs generated" },
  { value: BOARD_SUMMARY.riskFlags, label: "risks blocked" },
  { value: 1, label: "human reviews required" },
  { value: 6, label: "reusable templates" },
];

const PANELS: [string, string[]][] = [
  ["Workflow Summary", [
    "Market · 1.1s · complete",
    "Sourcing · 1.0s · complete",
    "Margin · 1.3s · complete",
    "Risk · 0.9s · complete",
    "Listing · 1.0s · complete",
    "Committee · 0.6s · complete",
  ]],
  ["Packaging Assets", [
    "1 localized Shopee title",
    "3 ranked selling points",
    "3 image prompts",
    "1 bundle + 1 gift strategy",
  ]],
  ["Export History", [
    "launch-pack-mini-desk-vacuum.zip",
    "listing-mini-desk-vacuum.json",
    "listing-mini-desk-vacuum.csv",
  ]],
  ["Reusable Templates", [
    "Desk-cleaning listing template",
    "USB gadget image-prompt set",
    "HDB lifestyle packaging skill",
  ]],
];

export default function DashboardPage() {
  return (
    <div className="px-14 py-7">
      <h1 className="font-display text-[34px] font-black tracking-tight text-ink mb-1">
        What your AI company produced.
      </h1>
      <p className="font-display text-base font-light italic text-ink-soft mb-8">
        One run · Shopee Singapore · Mini Desk Vacuum
      </p>

      {/* Metrics */}
      <div className="grid grid-cols-6 border-y hairline">
        {METRICS.map((m) => (
          <div key={m.label} className="border-r hairline px-4 py-5 last:border-r-0">
            <div className="font-display text-[40px] font-black leading-none text-ink mb-2">
              <CountUp value={m.value} />
            </div>
            <div className="font-mono text-[11px] leading-snug text-ink-faint">
              {m.label}
            </div>
          </div>
        ))}
      </div>

      {/* Panels */}
      <div className="grid grid-cols-2 gap-x-12 gap-y-8 mt-10">
        {PANELS.map(([title, rows]) => (
          <div key={title}>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-orange mb-3">
              {title}
            </p>
            {rows.map((r) => (
              <div key={r} className="border-t hairline py-2 last:border-b">
                <span className="text-[12px] text-ink-soft">{r}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
