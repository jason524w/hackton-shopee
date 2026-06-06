"use client";

import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="grid min-h-screen grid-cols-2">
      {/* Left brand panel */}
      <div className="flex flex-col justify-between bg-ink px-14 py-12">
        <Link href="/" className="font-display text-2xl font-semibold text-white">
          Sea<span className="italic text-orange">Launch</span> AI
        </Link>
        <div>
          <h1 className="font-display text-[52px] font-black leading-[0.95] tracking-tight text-white">
            Zero-person
            <br />
            company.
            <br />
            <span className="font-light italic text-orange">Endless</span> profit.
          </h1>
          <p className="font-display text-base font-light italic text-white/50 mt-5 max-w-sm">
            Sign in to put your AI commerce company to work on Shopee Singapore.
          </p>
        </div>
        <p className="font-mono text-[11px] tracking-widest text-white/30 uppercase">
          Shopee · Singapore
        </p>
      </div>

      {/* Right form */}
      <div className="flex flex-col justify-center bg-ivory px-14">
        <h2 className="font-display text-3xl font-black tracking-tight text-ink mb-1">
          Enter the workspace.
        </h2>
        <p className="font-display text-base font-light italic text-ink-soft mb-8">
          Start a run or continue where you left off.
        </p>
        <div className="flex max-w-sm flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
              Email
            </span>
            <input
              type="email"
              placeholder="you@store.com"
              className="border-b-2 hairline bg-transparent py-2 text-sm text-ink outline-none focus:border-orange"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.2em] text-ink-faint">
              Password
            </span>
            <input
              type="password"
              placeholder="••••••••"
              className="border-b-2 hairline bg-transparent py-2 text-sm text-ink outline-none focus:border-orange"
            />
          </label>
          <Link
            href="/app/brief"
            className="mt-2 rounded-full bg-orange px-6 py-3.5 text-center text-sm font-bold text-white"
          >
            Enter workspace →
          </Link>
          <Link
            href="/app/brief"
            className="text-center font-mono text-[11px] text-ink-faint"
          >
            _ Skip and try the demo
          </Link>
        </div>
      </div>
    </main>
  );
}
