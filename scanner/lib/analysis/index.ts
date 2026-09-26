import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { analyseWithClaude, CLAUDE_MODEL } from "./claude";
import { fallbackAnalysis } from "./fallback";
import type { AnalysisResult, ClientHints } from "./schema";

export function aiConfigured() {
  return process.env.ANALYSIS_PROVIDER !== "fallback" && Boolean(process.env.ANTHROPIC_API_KEY);
}

/** Claude when configured; on any failure, the clearly-labelled fallback. Never throws. */
export async function analyseGarment(jpegBase64: string, hints: ClientHints): Promise<AnalysisResult> {
  if (!aiConfigured()) {
    return { analysis: fallbackAnalysis(hints), model: "fallback", fallbackReason: "AI not configured" };
  }
  try {
    return { analysis: await analyseWithClaude(jpegBase64, hints.barcode ?? null), model: CLAUDE_MODEL };
  } catch (err) {
    const reason =
      err instanceof Anthropic.AuthenticationError ? "Invalid ANTHROPIC_API_KEY"
      : err instanceof Anthropic.RateLimitError ? "AI rate limited"
      : err instanceof Anthropic.APIConnectionTimeoutError ? "AI timed out"
      : err instanceof Anthropic.APIConnectionError ? "AI unreachable"
      : err instanceof Anthropic.APIError ? `AI error ${err.status}`
      : err instanceof Error ? err.message
      : "AI failed";
    console.error("[scanner] analysis failed, using fallback:", err);
    return { analysis: fallbackAnalysis(hints), model: "fallback", fallbackReason: reason };
  }
}
