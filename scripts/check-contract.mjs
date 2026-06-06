#!/usr/bin/env node
// Zero-dependency contract checker.
// Verifies contract/fixtures/sample-result.json satisfies contract/result.schema.json
// (required fields via $ref, type, and enum). Run: node scripts/check-contract.mjs
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const schema = JSON.parse(readFileSync(join(root, "contract/result.schema.json"), "utf8"));
const data = JSON.parse(readFileSync(join(root, "contract/fixtures/sample-result.json"), "utf8"));

const errors = [];
const resolve = (ref) => ref.replace("#/$defs/", "").split("/").reduce((o, k) => o[k], schema.$defs);

function check(node, sch, path) {
  if (!sch) return;
  if (sch.$ref) return check(node, resolve(sch.$ref), path);

  const types = sch.type ? [].concat(sch.type) : null;
  if (sch.enum && !sch.enum.includes(node)) {
    errors.push(`${path}: "${node}" not in enum [${sch.enum.join(", ")}]`);
  }
  if (types) {
    const t = Array.isArray(node) ? "array" : node === null ? "null" : typeof node;
    const ok = types.some((x) => x === t || (x === "number" && t === "number") || (x === "object" && t === "object"));
    if (!ok) errors.push(`${path}: expected ${types.join("|")}, got ${t}`);
  }
  if (node === null) return;

  if (sch.type === "object" || sch.properties || sch.required) {
    for (const key of sch.required || []) {
      if (!(key in node)) errors.push(`${path}: missing required "${key}"`);
    }
    for (const [key, val] of Object.entries(node)) {
      if (sch.properties?.[key]) check(val, sch.properties[key], `${path}.${key}`);
    }
  }
  if (sch.type === "array" && sch.items && Array.isArray(node)) {
    node.forEach((el, i) => check(el, sch.items, `${path}[${i}]`));
  }
}

check(data, schema, "$");

// ROADMAP §11: agents[] must be exactly these seven, in this order.
const EXPECTED_AGENTS = ["market", "sourcing", "margin", "risk", "listing", "packaging", "committee"];
const got = (data.agents || []).map((a) => a.key);
if (got.length !== EXPECTED_AGENTS.length || EXPECTED_AGENTS.some((k, i) => got[i] !== k)) {
  errors.push(`agents[]: expected exactly [${EXPECTED_AGENTS.join(", ")}], got [${got.join(", ")}]`);
}

if (errors.length) {
  console.error(`✗ contract check FAILED (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}
console.log("✓ fixtures/sample-result.json conforms to result.schema.json");
