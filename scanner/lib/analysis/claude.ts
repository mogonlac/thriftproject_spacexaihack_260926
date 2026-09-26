import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ANALYSIS_INSTRUCTIONS } from "./prompt";
import { coerceAnalysis, GarmentAnalysisSchema, type GarmentAnalysis } from "./schema";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

let client: Anthropic | null = null;

export async function analyseWithClaude(jpegBase64: string, barcodeHint: string | null): Promise<GarmentAnalysis> {
  client ??= new Anthropic({ timeout: 45_000, maxRetries: 1 });

  // fallbacks: "default" re-runs a (rare) safety decline on Anthropic's recommended model server-side.
  const response = await client.beta.messages.create({
    model: CLAUDE_MODEL,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    max_tokens: 8000,
    output_config: { effort: "low", format: zodOutputFormat(GarmentAnalysisSchema) },
    system: ANALYSIS_INSTRUCTIONS,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: jpegBase64 } },
          {
            type: "text",
            text: barcodeHint
              ? `Catalogue this item. A barcode scanner also decoded this code from the image: ${barcodeHint}`
              : "Catalogue this item.",
          },
        ],
      },
    ],
  });

  if (response.stop_reason === "refusal") throw new Error("Model declined to analyse the image");
  const text = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  if (!text) throw new Error(`No output (stop_reason=${response.stop_reason})`);
  return coerceAnalysis(JSON.parse(text));
}
