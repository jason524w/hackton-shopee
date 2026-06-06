"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { ExternalLink } from "lucide-react";
import { OPPORTUNITIES } from "@/lib/mock-data";
import { useAppStore } from "@/lib/store";
import { DecisionChip, StatusText } from "@/components/primitives/status";

const DEMO_CASES = OPPORTUNITIES.filter((o) =>
  [
    "mini-desk-vacuum",
    "portable-dehumidifier",
    "cable-organizer",
    "pet-grooming-tool",
    "compact-steamer",
  ].includes(o.id),
);

export default function HistoryPage() {
  const router = useRouter();
  const selectProduct = useAppStore((s) => s.selectProduct);

  function openCase(productId: string) {
    selectProduct(productId);
    router.push("/app/studio");
  }

  return (
    <div className="px-6 py-7 md:px-14">
      <div className="mb-8 flex flex-col gap-4 border-b hairline pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="mb-2 font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-orange">
            Demo Case History
          </p>
          <h1 className="font-display text-[42px] font-black leading-tight text-ink">
            Five product runs that look live.
          </h1>
          <p className="mt-2 max-w-2xl font-display text-base font-light italic text-ink-soft">
            Each case keeps the workflow explainable: source evidence, marketplace spread,
            region positioning, agent outputs, visual pack and committee decision.
          </p>
        </div>
        <button
          onClick={() => openCase("mini-desk-vacuum")}
          className="self-start bg-orange px-5 py-3 font-display text-sm font-black text-white"
        >
          Replay best case →
        </button>
      </div>

      <div className="grid gap-8">
        {DEMO_CASES.map((item) => (
          <article key={item.id} className="grid items-start gap-6 border-b hairline pb-8 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="relative aspect-[16/9] overflow-hidden bg-surface">
              <Image
                src={item.heroImage}
                alt={`${item.productName} generated listing visual`}
                fill
                className="object-cover object-center"
              />
            </div>

            <div className="flex flex-col">
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-[11px] text-ink-faint">
                    {item.targetMarkets.join(" + ")} · Shopee-ready demo
                  </p>
                  <h2 className="font-display text-[30px] font-black text-ink">
                    {item.productName}
                  </h2>
                </div>
                <DecisionChip decision={item.decision} />
              </div>

              <p className="mb-5 text-[14px] leading-relaxed text-ink-soft">
                {item.runSummary}
              </p>

              <div className="mb-5 grid grid-cols-2 gap-px bg-hairline">
                {[
                  ["Source", item.sourcePrice],
                  ["Selling band", item.suggestedSellingPrice],
                  ["Net margin", item.netMargin],
                  ["Risk", item.riskLevel],
                ].map(([label, value]) => (
                  <div key={label} className="bg-ivory p-3">
                    <p className="font-mono text-[10px] uppercase tracking-wide text-ink-faint">
                      {label}
                    </p>
                    <p className="mt-1 font-display text-[18px] font-black text-ink">
                      {value}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-5 grid gap-2 md:grid-cols-2">
                {item.regionSnapshots.map((region) => (
                  <div key={region.market} className="border border-hairline bg-surface p-3">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <p className="font-display text-base font-black text-ink">
                        {region.market}
                      </p>
                      <DecisionChip decision={region.decision} />
                    </div>
                    <p className="font-mono text-[11px] text-orange">{region.priceBand}</p>
                    <p className="mt-2 text-[12px] leading-snug text-ink-soft">
                      {region.buyerAngle}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mb-5">
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                  Clickable evidence
                </p>
                <div className="flex flex-col gap-2">
                  {item.evidenceLinks.map((link) => (
                    <a
                      key={link.href}
                      href={link.href}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center justify-between gap-3 border-t hairline py-2 text-[12px] text-ink-soft transition-colors hover:text-orange"
                    >
                      <span>
                        <span className="font-semibold text-ink">{link.label}</span>
                        <span className="ml-2 font-mono text-[11px] text-ink-faint">
                          {link.price}
                        </span>
                      </span>
                      <ExternalLink className="size-3.5 shrink-0" />
                    </a>
                  ))}
                </div>
              </div>

              <div className="mb-6">
                <p className="mb-2 font-mono text-[10px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
                  Agent trace
                </p>
                {item.agentTimeline.map((step) => (
                  <div key={step.agent} className="grid grid-cols-[120px_90px_1fr] gap-3 border-t hairline py-2">
                    <span className="font-display text-[13px] font-semibold text-ink">
                      {step.agent}
                    </span>
                    <StatusText status={step.status} />
                    <span className="text-[12px] leading-snug text-ink-soft">
                      {step.result}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={() => openCase(item.id)}
                className="mt-auto self-start bg-ink px-5 py-2.5 font-display text-xs font-black text-white"
              >
                Open in Packaging Studio →
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
