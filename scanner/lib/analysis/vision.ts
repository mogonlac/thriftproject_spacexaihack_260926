import "server-only";
import type { z } from "zod";
import { claudeJson, CLAUDE_MODEL } from "./claude";
import { geminiJson, GEMINI_MODEL } from "./gemini";

export interface VisionRequest {
  system: string;
  text: string;
  images: string[]; // base64 JPEGs
  schema: z.ZodType;
  timeoutMs: number;
}

export type Provider = "gemini" | "anthropic" | "fallback";

/** ANALYSIS_PROVIDER wins; otherwise the first provider with a key (Gemini, then Claude). */
export function activeProvider(): Provider {
  const forced = process.env.ANALYSIS_PROVIDER as Provider | undefined;
  if (forced === "fallback") return "fallback";
  if (forced === "gemini" && process.env.GEMINI_API_KEY) return "gemini";
  if (forced === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "fallback";
}

export function activeModel() {
  const p = activeProvider();
  return p === "gemini" ? GEMINI_MODEL : p === "anthropic" ? CLAUDE_MODEL : "fallback";
}

/** One structured-output vision call on the active provider. */
export function visionJson(req: VisionRequest) {
  const p = activeProvider();
  if (p === "gemini") return geminiJson(req);
  if (p === "anthropic") return claudeJson(req);
  throw new Error("No AI provider configured");
}
