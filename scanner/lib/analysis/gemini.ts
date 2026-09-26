import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import type { VisionRequest } from "./vision";

export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";

let ai: GoogleGenAI | null = null;

export async function geminiJson({ system, text, images, schema, timeoutMs }: VisionRequest): Promise<Record<string, unknown>> {
  ai ??= new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const res = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: [
      {
        role: "user",
        parts: [
          ...images.map((data) => ({ inlineData: { mimeType: "image/jpeg", data } })),
          { text },
        ],
      },
    ],
    config: {
      systemInstruction: system,
      responseMimeType: "application/json",
      responseJsonSchema: z.toJSONSchema(schema),
      temperature: 0.2,
      abortSignal: AbortSignal.timeout(timeoutMs),
    },
  });

  const out = res.text;
  if (!out) throw new Error(`Gemini returned no output (${res.candidates?.[0]?.finishReason ?? "unknown"})`);
  return JSON.parse(out);
}
