"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { SiteNav } from "@/components/marketing/site-nav";
import { CountUp } from "@/components/primitives/count-up";
import { staggerContainer, staggerItem } from "@/components/primitives/motion";
import { DEPARTMENTS, HOMEPAGE_STATS } from "@/lib/mock-data";
import { FLOW_STEPS } from "@/lib/flow";

const AGENT_DEPARTMENTS = [
  {
    cn: "市场洞察部",
    en: "Market Department",
    agent: "Market Agent",
    role: "Judges market heat, search trends, competitors, price band and platform opportunity.",
  },
  {
    cn: "货源采购部",
    en: "Sourcing Department",
    agent: "Sourcing Agent",
    role: "Finds supplier options, checks stock, MOQ, fulfillment stability and sourcing feasibility.",
  },
  {
    cn: "利润测算部",
    en: "Margin Department",
    agent: "Margin Agent",
    role: "Calculates true profit after cost, platform fees, logistics, ad room and scenario margins.",
  },
  {
    cn: "风险合规部",
    en: "Risk Department",
    agent: "Risk Agent",
    role: "Checks platform rules, compliance risk, IP risk, claims, battery and electronics safety.",
  },
  {
    cn: "商品上架部",
    en: "Listing Department",
    agent: "Listing Agent",
    role: "Generates title, bullets, keywords, image prompts, detail structure and platform fields.",
  },
  {
    cn: "包装增长部",
    en: "Packaging Department",
    agent: "Packaging Agent",
    role: "Designs bundles, gifts, visual direction and value framing to lift buyer appeal.",
  },
  {
    cn: "投审委员会",
    en: "Committee Department",
    agent: "Committee Agent",
    role: "Aggregates every department, resolves conflicts and outputs Go / Watch / Reject.",
  },
];

export default function Home() {
  return (
    <main className="min-h-screen bg-ivory">
      <SiteNav />

      {/* Hero */}
      <motion.section
        variants={staggerContainer}
        initial="hidden"
        animate="show"
        className="grid items-center gap-8 px-6 pt-12 pb-12 md:px-14 md:pt-18 lg:grid-cols-[3fr_2fr]"
      >
        <div>
          <motion.p
            variants={staggerItem}
            className="mb-8 font-mono text-xs font-medium uppercase tracking-[0.3em] text-orange"
          >
            Shopee Singapore · Built for one seller
          </motion.p>
          <motion.h1
            variants={staggerItem}
            className="mb-7 font-display text-[34px] font-black leading-[1.04] text-ink md:text-[44px] xl:text-[50px]"
          >
            <span className="whitespace-nowrap">One seller.</span>
            <br />
            <span className="whitespace-nowrap">One AI commerce team.</span>
            <br />
            <span className="whitespace-nowrap font-light italic text-orange">
              Endless Shopee-ready
            </span>
            <br />
            <span className="whitespace-nowrap">opportunities.</span>
          </motion.h1>
          <motion.p
            variants={staggerItem}
            className="max-w-xl font-display text-[21px] font-light italic leading-relaxed text-ink-soft"
          >
            Seven AI departments work like a real commerce company: market,
            sourcing, margin, risk, listing, packaging and committee.
          </motion.p>
          <motion.div variants={staggerItem} className="mt-8 flex flex-wrap items-center gap-3">
            <Link
              href="/app/brief"
              className="inline-flex items-center gap-3 rounded-full bg-orange px-7 py-4 text-sm font-bold text-white"
            >
              Build my AI commerce team →
            </Link>
            <Link
              href="/app/history"
              className="inline-flex items-center rounded-full border border-hairline bg-surface px-7 py-4 font-mono text-[12px] font-semibold text-ink"
            >
              Open demo history
            </Link>
          </motion.div>
        </div>
        <motion.div variants={staggerItem} className="relative flex justify-end">
          <Image
            src="/assets/sealaunch-departments-clean.png"
            alt="SeaLaunch AI department map"
            width={1426}
            height={1103}
            priority
            className="w-full max-w-[620px] bg-transparent object-contain xl:max-w-[700px]"
          />
        </motion.div>
      </motion.section>

      {/* Money band */}
      <section className="grid gap-px bg-ink px-6 py-8 md:grid-cols-4 md:px-14 md:py-12">
        {HOMEPAGE_STATS.map((s, i) => (
          <div
            key={i}
            className="border-r border-white/10 pr-9 last:border-r-0 last:pr-0"
          >
            <div className="font-display text-[56px] font-black leading-none tracking-tight text-white mb-3">
              <CountUp
                value={s.value}
                prefix={s.prefix}
                suffix={s.suffix}
                decimals={s.decimals ?? 0}
              />
            </div>
            <div className="font-mono text-[12px] leading-relaxed text-white/50">
              {s.label}
              <br />
              <span className="text-orange">{s.sub}</span>
            </div>
          </div>
        ))}
      </section>

      {/* Departments */}
      <section className="px-6 py-16 md:px-14">
        <div className="flex items-baseline justify-between mb-10">
          <h2 className="font-display text-[42px] font-black tracking-tight text-ink">
            Seven departments. <span className="font-light italic text-orange">One run.</span>
          </h2>
          <span className="font-mono text-[12px] uppercase tracking-widest text-ink-faint">
            AI Commerce Company
          </span>
        </div>
        <div>
          {DEPARTMENTS.map((d, i) => (
            <div
              key={d.id}
              className="group flex items-center gap-8 border-t hairline py-6 last:border-b"
            >
              <span className="font-mono text-sm text-ink-faint w-9">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="font-display text-[30px] font-semibold tracking-tight text-ink w-60 transition-colors group-hover:text-orange">
                {d.shortName}
              </span>
              <span className="font-display text-[19px] font-light italic text-ink-soft flex-1">
                {d.question}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t hairline px-6 py-16 md:px-14">
        <div className="mb-8 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <h2 className="font-display text-[38px] font-black text-ink">
            The company behind the run.
          </h2>
          <Link href="/app/history" className="font-mono text-[12px] font-semibold text-orange">
            View live case history →
          </Link>
        </div>
        <div className="grid gap-px bg-hairline md:grid-cols-7">
          {AGENT_DEPARTMENTS.map((d, i) => (
            <div key={d.agent} className="bg-surface p-4">
              <span className="font-mono text-[11px] text-ink-faint">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="mt-4 font-display text-[20px] font-black leading-tight text-ink">
                {d.agent}
              </h3>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-wide text-orange">
                {d.en}
              </p>
              <p className="mt-1 text-[12px] text-ink-soft">{d.cn}</p>
              <p className="mt-4 text-[12px] leading-relaxed text-ink-soft">{d.role}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flow strip */}
      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t hairline px-14 py-10">
        {["Seller Brief", "AI Commerce Co.", "Opportunity Board", "Packaging Studio", "Shopee-ready Launch Pack"].map(
          (label, i, arr) => (
            <span key={label} className="flex items-center gap-4">
              <span
                className={`font-mono text-[12px] font-medium tracking-wide ${
                  i === 1 || i === arr.length - 1 ? "text-orange" : "text-ink"
                }`}
              >
                {label}
              </span>
              {i < arr.length - 1 && <span className="text-ink-faint">→</span>}
            </span>
          ),
        )}
      </section>

      {/* Footer CTA */}
      <section className="border-t hairline px-14 py-20 text-center">
        <h2 className="font-display text-[52px] font-black tracking-tight text-ink mb-6">
          Your team is <span className="font-light italic text-orange">ready</span>.
        </h2>
        <Link
          href="/app/brief"
          className="inline-flex rounded-full bg-orange px-8 py-[18px] text-base font-bold text-white"
        >
          Build my AI commerce team →
        </Link>
        <p className="font-mono text-[11px] text-ink-faint mt-6">
          {FLOW_STEPS.length} steps · Shopee Singapore · English
        </p>
      </section>
    </main>
  );
}
