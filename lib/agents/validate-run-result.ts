// Runtime contract gate for /api/run (TASK-API-INTEGRATION #15).
//
// 铁律 1 / #15 验收:返回前必过 check-contract。This is the TS port of
// scripts/check-contract.mjs (same $ref/$defs resolution, same agent-order rule)
// so the live pipeline validates its assembled RunResult against
// contract/result.schema.json before responding — never ship an off-contract body.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// ROADMAP §11: agents[] must be exactly these seven, in this order.
export const CANONICAL_AGENT_ORDER = [
  "market",
  "sourcing",
  "margin",
  "risk",
  "listing",
  "packaging",
  "committee",
] as const;

interface SchemaNode {
  $ref?: string;
  type?: string | string[];
  enum?: unknown[];
  properties?: Record<string, SchemaNode>;
  required?: string[];
  items?: SchemaNode;
  $defs?: Record<string, SchemaNode>;
}

let cachedSchema: SchemaNode | null = null;

function loadSchema(): SchemaNode {
  if (!cachedSchema) {
    const raw = readFileSync(join(process.cwd(), "contract", "result.schema.json"), "utf8");
    cachedSchema = JSON.parse(raw) as SchemaNode;
  }
  return cachedSchema;
}

function resolveRef(schema: SchemaNode, ref: string): SchemaNode {
  return ref
    .replace("#/$defs/", "")
    .split("/")
    .reduce<SchemaNode>((node, key) => (node as unknown as Record<string, SchemaNode>)[key], schema.$defs as unknown as SchemaNode);
}

function check(
  schema: SchemaNode,
  node: unknown,
  sch: SchemaNode | undefined,
  path: string,
  errors: string[],
): void {
  if (!sch) return;
  if (sch.$ref) return check(schema, node, resolveRef(schema, sch.$ref), path, errors);

  const types = sch.type ? ([] as string[]).concat(sch.type) : null;
  if (sch.enum && !sch.enum.includes(node)) {
    errors.push(`${path}: ${JSON.stringify(node)} not in enum [${sch.enum.join(", ")}]`);
  }
  if (types) {
    const t = Array.isArray(node) ? "array" : node === null ? "null" : typeof node;
    const ok = types.some((x) => x === t);
    if (!ok) errors.push(`${path}: expected ${types.join("|")}, got ${t}`);
  }
  if (node === null || typeof node !== "object") {
    // primitives and null are fully checked above
    if (sch.type === "array" || sch.required) {
      // a non-object where the schema wanted structure — already flagged by type check
    }
    return;
  }

  if (sch.type === "object" || sch.properties || sch.required) {
    for (const key of sch.required ?? []) {
      if (!(key in (node as Record<string, unknown>))) {
        errors.push(`${path}: missing required "${key}"`);
      }
    }
    for (const [key, val] of Object.entries(node as Record<string, unknown>)) {
      if (sch.properties?.[key]) check(schema, val, sch.properties[key], `${path}.${key}`, errors);
    }
  }
  if (sch.type === "array" && sch.items && Array.isArray(node)) {
    node.forEach((el, i) => check(schema, el, sch.items, `${path}[${i}]`, errors));
  }
}

/** Returns a list of contract violations; empty array means the value is valid. */
export function validateRunResult(value: unknown): string[] {
  const schema = loadSchema();
  const errors: string[] = [];
  check(schema, value, schema, "$", errors);

  const agents = (value as { agents?: { key?: string }[] } | null)?.agents ?? [];
  const got = agents.map((a) => a.key);
  if (
    got.length !== CANONICAL_AGENT_ORDER.length ||
    CANONICAL_AGENT_ORDER.some((k, i) => got[i] !== k)
  ) {
    errors.push(
      `agents[]: expected exactly [${CANONICAL_AGENT_ORDER.join(", ")}], got [${got.join(", ")}]`,
    );
  }

  return errors;
}

/** Throws if the assembled RunResult is off-contract. Used as the #15 return gate. */
export function assertValidRunResult(value: unknown): void {
  const errors = validateRunResult(value);
  if (errors.length) {
    throw new ContractViolationError(errors);
  }
}

export class ContractViolationError extends Error {
  readonly errors: string[];
  constructor(errors: string[]) {
    super(`RunResult failed contract check (${errors.length}):\n  - ${errors.join("\n  - ")}`);
    this.name = "ContractViolationError";
    this.errors = errors;
  }
}
