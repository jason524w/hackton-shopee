import { readFile } from "node:fs/promises";
import { join } from "node:path";

export interface ProviderSource {
  provider: string;
  mode: "live" | "seed";
  fixture_id?: string;
  source_url?: string;
  captured_at: string;
}

export interface ProviderWarning {
  code: string;
  message: string;
  severity: "info" | "warning" | "error";
}

export interface ProviderResultMeta {
  source: ProviderSource;
  warnings?: ProviderWarning[];
}

export async function readSeedJson<T>(relativePath: string): Promise<T> {
  const absolutePath = join(process.cwd(), relativePath);
  const raw = await readFile(absolutePath, "utf8");
  return JSON.parse(raw) as T;
}

export function normalizeQuery(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function includesQuery(text: string, query: string): boolean {
  const normalizedText = normalizeQuery(text);
  return normalizeQuery(query)
    .split(" ")
    .filter(Boolean)
    .every((part) => normalizedText.includes(part));
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function roundMoney(value: number, decimals = 2): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
