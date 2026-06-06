"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FLOW_STEPS, flowKeyForPath } from "@/lib/flow";

export function ShellBar() {
  const pathname = usePathname();
  const activeKey = flowKeyForPath(pathname);
  const activeIndex = FLOW_STEPS.findIndex((s) => s.key === activeKey);

  return (
    <div className="flex items-center justify-between border-b hairline bg-surface px-14 py-3">
      <Link href="/" className="font-display text-lg font-semibold text-ink">
        Sea<span className="italic text-orange">Launch</span> AI
      </Link>
      <div className="flex items-center">
        <div className="flex items-center">
          {FLOW_STEPS.map((step, i) => {
            const state =
              i < activeIndex ? "done" : i === activeIndex ? "active" : "todo";
            const cls =
              state === "done"
                ? "text-go"
                : state === "active"
                  ? "text-ink"
                  : "text-ink-faint";
            const glyph = state === "done" ? "✓" : state === "active" ? "●" : "○";
            return (
              <Link
                key={step.key}
                href={step.href}
                className={`border-r hairline px-3 font-mono text-[12px] font-semibold tracking-wide transition-colors last:border-r-0 hover:text-orange ${cls}`}
              >
                {glyph} {step.label}
              </Link>
            );
          })}
        </div>
        <Link
          href="/app/dashboard"
          className={`ml-5 rounded-full border px-3 py-1 font-mono text-[12px] font-semibold tracking-wide transition-colors hover:text-orange ${
            pathname.startsWith("/app/dashboard")
              ? "border-orange text-orange"
              : "border-hairline text-ink-faint"
          }`}
        >
          ◆ Dashboard
        </Link>
        <Link
          href="/app/history"
          className={`ml-3 rounded-full border px-3 py-1 font-mono text-[12px] font-semibold tracking-wide transition-colors hover:text-orange ${
            pathname.startsWith("/app/history")
              ? "border-orange text-orange"
              : "border-hairline text-ink-faint"
          }`}
        >
          ◆ History
        </Link>
      </div>
    </div>
  );
}
