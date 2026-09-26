import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { ANALYSIS_INSTRUCTIONS } from "./prompt";
import { coerceAnalysis, GarmentAnalysisSchema, type GarmentAnalysis } from "./schema";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

const RESPONSE_SCHEMA = z.toJSONSchema(GarmentAnalysisSchema);

let ai: GoogleGenAI | null = null;

export async function analyseWithGemini(jpegBase64: string, barcodeHint: string | null): Promise<GarmentAnalysis> {
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: jpegBase64 } },
          {
            text: barcodeHint
              ? `Catalogue this item. A barcode scanner also decoded this code from the image: ${barcodeHint}`
              : "Catalogue this item.",
          },
        ],
      },
    ],
    config: {
      systemInstruction: ANALYSIS_INSTRUCTIONS,
      responseMimeType: "application/json",
      responseJsonSchema: RESPONSE_SCHEMA,
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(30_000),
    },
  });

  const text = res.text;
  if (!text) throw new Error(`Gemini returned no output (${res.candidates?.[0]?.finishReason ?? "unknown"})`);
  return coerceAnalysis(JSON.parse(text));
}
