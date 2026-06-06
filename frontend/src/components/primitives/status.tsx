import type { DeptStatus, Decision } from "@/lib/types";

const STATUS_META: Record<DeptStatus, { glyph: string; label: string; cls: string }> = {
  complete: { glyph: "●", label: "COMPLETE", cls: "text-go" },
  running: { glyph: "◉", label: "RUNNING", cls: "text-orange" },
  waiting: { glyph: "○", label: "WAITING", cls: "text-ink-faint" },
  blocked: { glyph: "✕", label: "BLOCKED", cls: "text-reject" },
  review: { glyph: "⚠", label: "REVIEW", cls: "text-watch" },
};

export function StatusText({ status }: { status: DeptStatus }) {
  const m = STATUS_META[status];
  return (
    <span className={`font-mono text-[12px] font-semibold tracking-wide ${m.cls}`}>
      <span className={status === "running" ? "animate-pulse" : ""}>{m.glyph}</span>{" "}
      {m.label}
    </span>
  );
}

const DECISION_META: Record<Decision, { label: string; cls: string }> = {
  go: { label: "GO", cls: "text-go bg-go/[0.07]" },
  watch: { label: "WATCH", cls: "text-watch bg-watch/[0.07]" },
  reject: { label: "REJECT", cls: "text-reject bg-reject/[0.07]" },
};

export function DecisionChip({ decision }: { decision: Decision }) {
  const m = DECISION_META[decision];
  return (
    <span
      className={`font-display text-xs font-extrabold px-2 py-1 ${m.cls}`}
    >
      {m.label}
    </span>
  );
}
