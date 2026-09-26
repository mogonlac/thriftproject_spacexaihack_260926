import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { fallbackAnalysis } from "./fallback";
import { ANALYSIS_INSTRUCTIONS, TAG_READ_INSTRUCTIONS } from "./prompt";
import { coerceAnalysis, coerceTagRead, GarmentAnalysisSchema, TagReadSchema, type AnalysisResult, type ClientHints } from "./schema";
import { cropLabels, downscale, mergeTagRead, needsTagPass } from "./tags";
import { valueGarment, type Valuation } from "./valuation";
import { activeModel, activeProvider, visionJson } from "./vision";

export { activeModel, activeProvider };

function describeError(err: unknown) {
  if (err instanceof Anthropic.AuthenticationError) return "Invalid ANTHROPIC_API_KEY";
  if (err instanceof Anthropic.RateLimitError) return "AI rate limited";
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "AI timed out";
  if (err instanceof Anthropic.APIConnectionError) return "AI unreachable";
  if (err instanceof Anthropic.APIError) return `AI error ${err.status}`;
  if (err instanceof Error) return err.name === "TimeoutError" || err.name === "AbortError" ? "AI timed out" : err.message.slice(0, 160);
  return "AI failed";
}

/**
 * Pass 1: whole garment (downscaled) → category, colour, condition, … and where the tags are.
 * Pass 2 (only if a tag is visible but price/size wasn't read): enlarged full-res tag crops → price, size, brand.
 * In parallel with pass 2: market valuation from UK resale listings (Tavily), when configured.
 * Any AI failure falls back to the clearly-labelled fallback analyser. Never throws.
 */
export async function analyseGarment(photo: Buffer, hints: ClientHints): Promise<AnalysisResult> {
  if (activeProvider() === "fallback") {
    return { analysis: fallbackAnalysis(hints), model: "fallback", fallbackReason: "AI not configured" };
  }

  let analysis;
  try {
    const raw = await visionJson({
      system: ANALYSIS_INSTRUCTIONS,
      text: hints.barcode
        ? `Catalogue this item. A barcode scanner also decoded this code from the image: ${hints.barcode}`
        : "Catalogue this item.",
      images: [await downscale(photo)],
      schema: GarmentAnalysisSchema,
      timeoutMs: 40_000,
    });
    analysis = coerceAnalysis(raw);
  } catch (err) {
    console.error("[scanner] analysis failed, using fallback:", err);
    return { analysis: fallbackAnalysis(hints), model: "fallback", fallbackReason: describeError(err) };
  }

  if (!analysis.is_garment) return { analysis, model: activeModel() };
  const first = analysis;

  const tagPass = async () => {
    if (!needsTagPass(first)) return { analysis: first, crops: 0 };
    try {
      const crops = await cropLabels(photo, first.label_boxes);
      if (!crops.length) return { analysis: first, crops: 0 };
      const read = coerceTagRead(await visionJson({
        system: TAG_READ_INSTRUCTIONS,
        text: `Read these ${crops.length} tag/label close-up(s) from one garment.`,
        images: crops,
        schema: TagReadSchema,
        timeoutMs: 20_000,
      }));
      return { analysis: mergeTagRead(first, read), crops: crops.length };
    } catch (err) {
      // The first-pass result is still good; the tag close-up is a bonus.
      console.warn("[scanner] tag close-up pass failed:", describeError(err));
      return { analysis: first, crops: 0 };
    }
  };

  const valuation = async (): Promise<Valuation | null> => {
    try {
      return await valueGarment(first);
    } catch (err) {
      console.warn("[scanner] market valuation failed:", describeError(err));
      return null;
    }
  };

  const [tags, market] = await Promise.all([tagPass(), valuation()]);
  return { analysis: tags.analysis, model: activeModel(), tagCrops: tags.crops, valuation: market };
}
