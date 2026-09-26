import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { coerceAnalysis, GarmentAnalysisSchema, type GarmentAnalysis } from "./schema";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

const SYSTEM = `You catalogue donated clothing for a UK charity shop. You are shown one photo from a fixed scanning station: a single item on a hanger against a plain background. Staff may have attached a swing tag or price sticker.

Fill in every field of the schema from what is visible in the photo.
- Read text on labels and tags carefully (brand, size, price, item code). If text is not clearly legible, use null. Never invent a brand, size or price.
- tag_price_gbp is only a price physically printed or written on the shop's tag. suggested_price_gbp is your own estimate for a UK charity shop (typically £3–£40; more for premium brands or designer items).
- Judge condition only from visible cues. If none are visible, 'good' with modest confidence.
- Confidence values are honest probabilities in 0–1.
- If there is no clothing item in the photo, set is_garment to false and fill the other fields with your best placeholder values at confidence 0.`;

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
    system: SYSTEM,
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
