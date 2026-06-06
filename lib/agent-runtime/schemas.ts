export type JsonPrimitiveType = "array" | "boolean" | "integer" | "null" | "number" | "object" | "string";

export interface JsonSchema {
  type?: JsonPrimitiveType | JsonPrimitiveType[];
  title?: string;
  description?: string;
  enum?: unknown[];
  const?: unknown;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  items?: JsonSchema;
  additionalProperties?: boolean | JsonSchema;
  anyOf?: JsonSchema[];
  oneOf?: JsonSchema[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  minItems?: number;
  maxItems?: number;
}

export interface SchemaValidationResult {
  valid: boolean;
  errors: string[];
}

export interface ParsedJsonResult<T = unknown> {
  ok: boolean;
  value?: T;
  error?: string;
}

export function validateJsonSchema(schema: JsonSchema, value: unknown): SchemaValidationResult {
  const errors: string[] = [];
  validate(schema, value, "$", errors);
  return { valid: errors.length === 0, errors };
}

export function parseJsonObject<T = unknown>(text: string): ParsedJsonResult<T> {
  const direct = tryParseJson<T>(text);
  if (direct.ok) {
    return direct;
  }

  const trimmed = stripMarkdownFence(text.trim());
  const fenced = tryParseJson<T>(trimmed);
  if (fenced.ok) {
    return fenced;
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return tryParseJson<T>(trimmed.slice(firstBrace, lastBrace + 1));
  }

  return direct;
}

export function createResponseTextFormat(name: string, schema: JsonSchema, strict = true): Record<string, unknown> {
  return {
    format: {
      type: "json_schema",
      name,
      strict,
      schema,
    },
  };
}

export function makeObjectSchema(
  properties: Record<string, JsonSchema>,
  required = Object.keys(properties),
): JsonSchema {
  return {
    type: "object",
    properties,
    required,
    additionalProperties: false,
  };
}

function validate(schema: JsonSchema, value: unknown, path: string, errors: string[]): void {
  if (schema.const !== undefined && !deepEqual(value, schema.const)) {
    errors.push(`${path} must equal ${JSON.stringify(schema.const)}`);
    return;
  }

  if (schema.enum && !schema.enum.some((item) => deepEqual(item, value))) {
    errors.push(`${path} must be one of ${schema.enum.map((item) => JSON.stringify(item)).join(", ")}`);
    return;
  }

  if (schema.anyOf?.length) {
    const results = schema.anyOf.map((candidate) => validateJsonSchema(candidate, value));
    if (results.every((result) => !result.valid)) {
      errors.push(`${path} must match at least one schema: ${results.flatMap((result) => result.errors).join("; ")}`);
    }
    return;
  }

  if (schema.oneOf?.length) {
    const validCount = schema.oneOf.filter((candidate) => validateJsonSchema(candidate, value).valid).length;
    if (validCount !== 1) {
      errors.push(`${path} must match exactly one schema, matched ${validCount}`);
    }
    return;
  }

  if (schema.type && !matchesType(value, schema.type)) {
    errors.push(`${path} must be ${Array.isArray(schema.type) ? schema.type.join(" or ") : schema.type}`);
    return;
  }

  if (isObject(value)) {
    validateObject(schema, value, path, errors);
  }

  if (Array.isArray(value)) {
    validateArray(schema, value, path, errors);
  }

  if (typeof value === "string") {
    validateString(schema, value, path, errors);
  }

  if (typeof value === "number") {
    validateNumber(schema, value, path, errors);
  }
}

function validateObject(
  schema: JsonSchema,
  value: Record<string, unknown>,
  path: string,
  errors: string[],
): void {
  for (const key of schema.required ?? []) {
    if (!(key in value)) {
      errors.push(`${path}.${key} is required`);
    }
  }

  const properties = schema.properties ?? {};
  for (const [key, childValue] of Object.entries(value)) {
    const childSchema = properties[key];
    if (childSchema) {
      validate(childSchema, childValue, `${path}.${key}`, errors);
      continue;
    }

    if (schema.additionalProperties === false) {
      errors.push(`${path}.${key} is not allowed`);
    } else if (isSchema(schema.additionalProperties)) {
      validate(schema.additionalProperties, childValue, `${path}.${key}`, errors);
    }
  }
}

function validateArray(schema: JsonSchema, value: unknown[], path: string, errors: string[]): void {
  if (schema.minItems !== undefined && value.length < schema.minItems) {
    errors.push(`${path} must contain at least ${schema.minItems} item(s)`);
  }

  if (schema.maxItems !== undefined && value.length > schema.maxItems) {
    errors.push(`${path} must contain at most ${schema.maxItems} item(s)`);
  }

  if (schema.items) {
    value.forEach((item, index) => validate(schema.items as JsonSchema, item, `${path}[${index}]`, errors));
  }
}

function validateString(schema: JsonSchema, value: string, path: string, errors: string[]): void {
  if (schema.minLength !== undefined && value.length < schema.minLength) {
    errors.push(`${path} must be at least ${schema.minLength} character(s)`);
  }

  if (schema.maxLength !== undefined && value.length > schema.maxLength) {
    errors.push(`${path} must be at most ${schema.maxLength} character(s)`);
  }
}

function validateNumber(schema: JsonSchema, value: number, path: string, errors: string[]): void {
  if (schema.minimum !== undefined && value < schema.minimum) {
    errors.push(`${path} must be >= ${schema.minimum}`);
  }

  if (schema.maximum !== undefined && value > schema.maximum) {
    errors.push(`${path} must be <= ${schema.maximum}`);
  }
}

function matchesType(value: unknown, type: JsonPrimitiveType | JsonPrimitiveType[]): boolean {
  const types = Array.isArray(type) ? type : [type];
  return types.some((candidate) => {
    if (candidate === "array") {
      return Array.isArray(value);
    }
    if (candidate === "integer") {
      return Number.isInteger(value);
    }
    if (candidate === "null") {
      return value === null;
    }
    if (candidate === "object") {
      return isObject(value);
    }
    return typeof value === candidate;
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isSchema(value: unknown): value is JsonSchema {
  return isObject(value);
}

function deepEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function tryParseJson<T>(text: string): ParsedJsonResult<T> {
  try {
    return { ok: true, value: JSON.parse(text) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

function stripMarkdownFence(text: string): string {
  const match = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return match ? match[1] : text;
}
