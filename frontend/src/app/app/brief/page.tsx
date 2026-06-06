"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/lib/store";
import { DEMO_BRIEF } from "@/lib/mock-data";

function Segmented({
  options,
  defaultValue,
  onChange,
}: {
  options: string[];
  defaultValue: string;
  onChange?: (value: string) => void;
}) {
  const [selected, setSelected] = useState(defaultValue);
  function choose(value: string) {
    setSelected(value);
    onChange?.(value);
  }
  return (
    <div className="flex flex-wrap gap-3">
      {options.map((o) => (
        <button
          key={o}
          type="button"
          onClick={() => choose(o)}
          className={`cursor-pointer border-b-2 px-2.5 py-1 text-[11px] transition-colors ${
            o === selected
              ? "border-ink font-semibold text-ink"
              : "border-transparent text-ink-soft hover:text-ink"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
        {label}
      </span>
      {children}
    </div>
  );
}

export default function BriefPage() {
  const router = useRouter();
  const { loadDemoBrief, startRun, setBrief } = useAppStore();
  const [targetMarket, setTargetMarket] = useState(DEMO_BRIEF.targetMarket);
  const [keywords, setKeywords] = useState(DEMO_BRIEF.keywords);
  const [budgetRange, setBudgetRange] = useState(DEMO_BRIEF.budgetRange);
  const [expectedMargin, setExpectedMargin] = useState(DEMO_BRIEF.expectedMargin);
  const [riskPreference, setRiskPreference] = useState("Balanced");

  function start() {
    setBrief({
      ...DEMO_BRIEF,
      targetMarket,
      keywords,
      budgetRange,
      expectedMargin,
      riskPreference:
        riskPreference === "Conservative"
          ? "conservative"
          : riskPreference === "High-risk"
            ? "high_risk"
            : "balanced",
    });
    startRun();
    router.push("/app/org-room");
  }
  function demo() {
    loadDemoBrief();
    start();
  }

  return (
    <div>
      <div className="px-14 pt-8 pb-6">
        <h1 className="font-display text-[42px] font-black tracking-tight text-ink mb-1">
          Tell your AI company what to find.
        </h1>
        <p className="font-display text-lg font-light italic text-ink-soft">
          1–2 minutes. Your team starts immediately.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-x-10 gap-y-7 px-14 pb-8">
        <Field label="Target Market">
          <Segmented
            options={["Singapore", "Malaysia", "Thailand"]}
            defaultValue="Singapore"
            onChange={setTargetMarket}
          />
        </Field>
        <Field label="Platform">
          <span className="border-b-2 border-orange py-2 font-mono text-[12px] font-semibold text-orange">
            Shopee ·
          </span>
        </Field>
        <Field label="Product Direction">
          <input
            defaultValue={DEMO_BRIEF.keywords}
            onChange={(e) => setKeywords(e.target.value)}
            className="border-b-2 hairline bg-transparent py-2 text-sm text-ink outline-none focus:border-orange"
          />
        </Field>
        <Field label="Budget Range">
          <input
            defaultValue={DEMO_BRIEF.budgetRange}
            onChange={(e) => setBudgetRange(e.target.value)}
            className="border-b-2 hairline bg-transparent py-2 text-sm text-ink outline-none focus:border-orange"
          />
        </Field>
        <Field label="Margin Target">
          <Segmented
            options={["20%", "30%", "50%+"]}
            defaultValue="30%"
            onChange={setExpectedMargin}
          />
        </Field>
        <Field label="Risk Preference">
          <Segmented
            options={["Conservative", "Balanced", "High-risk"]}
            defaultValue="Balanced"
            onChange={setRiskPreference}
          />
        </Field>
      </div>

      <div className="flex items-center justify-between border-t hairline px-14 py-5">
        <button
          onClick={start}
          className="bg-ink px-6 py-2.5 font-display text-sm font-black text-white"
        >
          Start AI Company Run →
        </button>
        <button onClick={demo} className="font-mono text-[11px] text-ink-faint">
          _ Use demo: <span className="text-orange">Mini desk vacuum in Singapore</span>
        </button>
      </div>
    </div>
  );
}
