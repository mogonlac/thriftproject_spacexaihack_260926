import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import type { VisionRequest } from "./vision";

export const CLAUDE_MODEL = process.env.ANTHROPIC_MODEL || "claude-opus-5";

let client: Anthropic | null = null;

export async function claudeJson({ system, text, images, schema, timeoutMs }: VisionRequest): Promise<Record<string, unknown>> {
  client ??= new Anthropic({ maxRetries: 1 });

  // fallbacks: "default" re-runs a (rare) safety decline on Anthropic's recommended model server-side.
  const response = await client.beta.messages.create(
    {
      model: CLAUDE_MODEL,
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      max_tokens: 8000,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system,
      messages: [
        {
          role: "user",
          content: [
            ...images.map((data) => ({
              type: "image" as const,
              source: { type: "base64" as const, media_type: "image/jpeg" as const, data },
            })),
            { type: "text", text },
          ],
        },
      ],
    },
    { timeout: timeoutMs },
  );

  if (response.stop_reason === "refusal") throw new Error("Model declined to analyse the image");
  const out = response.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  if (!out) throw new Error(`No output (stop_reason=${response.stop_reason})`);
  return JSON.parse(out);
}
