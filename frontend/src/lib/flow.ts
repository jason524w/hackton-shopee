export const FLOW_STEPS = [
  { key: "brief", label: "Brief", href: "/app/brief" },
  { key: "company", label: "Company", href: "/app/org-room" },
  { key: "board", label: "Board", href: "/app/board" },
  { key: "studio", label: "Studio", href: "/app/studio" },
  { key: "listing", label: "Listing", href: "/app/listing" },
] as const;

export type FlowKey = (typeof FLOW_STEPS)[number]["key"];

/** Percentage the progress bar fills for a given step. */
export function progressFor(key: FlowKey): number {
  const index = FLOW_STEPS.findIndex((s) => s.key === key);
  return ((index + 1) / FLOW_STEPS.length) * 100;
}

/** Map a pathname under /app to its flow key, or null for non-flow pages. */
export function flowKeyForPath(pathname: string): FlowKey | null {
  if (pathname.startsWith("/app/brief")) return "brief";
  if (pathname.startsWith("/app/org-room")) return "company";
  if (pathname.startsWith("/app/board")) return "board";
  if (pathname.startsWith("/app/studio")) return "studio";
  if (pathname.startsWith("/app/listing")) return "listing";
  return null;
}
