import OpenAI from "openai";

// Shared OpenAI client for Sea Launch AI.
// Live agents and the image provider import from here so model config lives in one place.

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Copy .env.example to .env.local and fill it in.");
  }
  if (!client) {
    client = new OpenAI({ apiKey });
  }
  return client;
}

export const OPENAI_TEXT_MODEL = process.env.OPENAI_TEXT_MODEL ?? "gpt-4o";
export const OPENAI_IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? "gpt-image-1";
