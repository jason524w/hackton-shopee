"use client";

import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useAppStore } from "@/lib/store";
import { OPPORTUNITIES, BOARD_SUMMARY } from "@/lib/mock-data";
import { DecisionChip } from "@/components/primitives/status";

const COLS =
  "grid grid-cols-[2.2fr_0.9fr_0.9fr_0.9fr_0.9fr_90px] items-center gap-0";

export default function BoardPage() {
  const router = useRouter();
  const selectProduct = useAppStore((s) => s.selectProduct);

  function select(id: string) {
    selectProduct(id);
    router.push("/app/studio");
  }

  return (
    <div className="px-14 py-7">
      <h1 className="font-display text-[34px] font-black tracking-tight text-ink mb-1">
        {BOARD_SUMMARY.found} opportunities found.
      </h1>
      <p className="font-mono text-[11px] tracking-wide text-ink-faint">
        <span className="text-ink">{BOARD_SUMMARY.go} Go</span> ·{" "}
        <span className="text-ink">{BOARD_SUMMARY.watch} Watch</span> · avg margin{" "}
        <span className="text-ink">{BOARD_SUMMARY.avgMargin}</span> ·{" "}
        {BOARD_SUMMARY.riskFlags} risk flag
      </p>
      <Link href="/app/committee" className="font-mono text-[11px] text-orange mb-6 inline-block">
        View full committee review →
      </Link>

      <div className={`${COLS} pb-2`}>
        {["Product", "Source", "Price", "Margin", "Risk", "Decision"].map((h) => (
          <span
            key={h}
            className="font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint"
          >
            {h}
          </span>
        ))}
      </div>

      {OPPORTUNITIES.map((o, i) => (
        <motion.button
          key={o.id}
          onClick={() => select(o.id)}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.1 }}
          className={`${COLS} group w-full border-t hairline py-3 text-left last:border-b`}
        >
          <span className="flex items-center gap-3 pr-4">
            <span className="relative h-14 w-20 shrink-0 overflow-hidden bg-ivory-deep">
              <Image src={o.heroImage} alt={o.productName} fill className="object-cover" />
            </span>
            <span>
              <span className="font-display text-[15px] font-semibold text-ink transition-colors group-hover:text-orange">
                {o.productName}
              </span>
              <span className="block font-display text-[11px] font-light italic text-ink-faint">
                {o.productDirection}
              </span>
              <span className="mt-1 block font-mono text-[10px] text-orange">
                {o.targetMarkets.join(" + ")} · {o.evidenceLinks.length || 1} evidence links
              </span>
            </span>
          </span>
          <span className="font-mono text-[12px] text-ink-soft">{o.sourcePrice}</span>
          <span className="font-mono text-[12px] text-ink-soft">
            {o.suggestedSellingPrice}
          </span>
          <span
            className={`font-mono text-[12px] ${
              o.decision === "go" ? "text-go" : "text-watch"
            }`}
          >
            {o.netMargin}
          </span>
          <span
            className={`font-mono text-[12px] ${
              o.riskLevel === "Low" ? "text-go" : "text-watch"
            }`}
          >
            {o.riskLevel}
          </span>
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: i * 0.1 + 0.2, type: "spring" }}
          >
            <DecisionChip decision={o.decision} />
          </motion.span>
        </motion.button>
      ))}
    </div>
  );
}
