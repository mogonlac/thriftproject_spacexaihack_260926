import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { analyseWithClaude, CLAUDE_MODEL } from "./claude";
import { fallbackAnalysis } from "./fallback";
import { analyseWithGemini, GEMINI_MODEL } from "./gemini";
import type { AnalysisResult, ClientHints, GarmentAnalysis } from "./schema";

type Provider = "gemini" | "anthropic" | "fallback";

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

function describeError(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return "Invalid ANTHROPIC_API_KEY";
  if (err instanceof Anthropic.RateLimitError) return "AI rate limited";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "AI timed out";
  if (err instanceof Anthropic.APIConnectionError) return "AI unreachable";
  if (err instanceof Anthropic.APIError) return `AI error ${err.status}`;
  if (err instanceof Error) return err.name === "TimeoutError" || err.name === "AbortError" ? "AI timed out" : err.message.slice(0, 160);
  return "AI failed";
}

/** Runs the configured vision model; on any failure, the clearly-labelled fallback. Never throws. */
export async function analyseGarment(jpegBase64: string, hints: ClientHints): Promise<AnalysisResult> {
  const provider = activeProvider();
  if (provider === "fallback") {
    return { analysis: fallbackAnalysis(hints), model: "fallback", fallbackReason: "AI not configured" };
  }
  try {
    const run: Promise<GarmentAnalysis> = provider === "gemini"
      ? analyseWithGemini(jpegBase64, hints.barcode ?? null)
      : analyseWithClaude(jpegBase64, hints.barcode ?? null);
    return { analysis: await run, model: activeModel() };
  } catch (err) {
    console.error(`[scanner] ${provider} analysis failed, using fallback:`, err);
    return { analysis: fallbackAnalysis(hints), model: "fallback", fallbackReason: describeError(err) };
  }
}
