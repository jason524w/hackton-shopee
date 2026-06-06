import Link from "next/link";

export function SiteNav() {
  return (
    <nav className="flex items-center justify-between border-b hairline px-14 py-6">
      <Link href="/" className="font-display text-2xl font-semibold tracking-tight text-ink">
        Sea<span className="italic text-orange">Launch</span> AI
      </Link>
      <div className="flex items-center gap-8">
        <span className="text-sm text-ink-soft">Platform</span>
        <span className="text-sm text-ink-soft">How it works</span>
        <Link href="/app/history" className="text-sm text-ink-soft hover:text-orange">
          Case history
        </Link>
        <Link
          href="/app/brief"
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-semibold text-white"
        >
          Build my team
        </Link>
      </div>
    </nav>
  );
}
