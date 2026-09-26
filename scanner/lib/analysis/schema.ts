import { z } from "zod";
import { ALPHA_SIZES, CATEGORIES, COLOURS, CONDITIONS, DEPARTMENTS } from "../types";

// What the vision model returns. Constrained to the storefront's enums so the
// output can be written straight into the shared items table.
export const GarmentAnalysisSchema = z.object({
  is_garment: z.boolean().describe("False if the image shows no clothing item (empty hanger, a person, a card)."),
  title: z.string().describe("Short shop-floor title, colour first, e.g. 'Black denim jacket'. Max 6 words."),
  description: z.string().describe("One or two plain sentences a shopper would find useful."),
  department: z.enum(DEPARTMENTS),
  category: z.enum(CATEGORIES),
  subcategory: z.string().nullable().describe("e.g. 'Denim jacket', 'Midi dress', 'Crew-neck jumper'"),
  colour: z.enum(COLOURS).describe("Dominant colour. Use 'multi' only if no single colour dominates."),
  secondary_colours: z.array(z.string()),
  pattern: z.string().nullable().describe("solid, striped, checked, floral, graphic, animal, etc."),
  material: z.string().nullable().describe("Likely material from texture, e.g. 'denim', 'wool knit'. Null if unclear."),
  brand: z.string().nullable().describe("Only if a brand label/logo is legible. Otherwise null — never guess."),
  size_label: z.string().nullable().describe("Size exactly as printed on a visible label or tag. Null if not legible."),
  size_alpha: z.enum(ALPHA_SIZES).nullable().describe("Normalised alpha size, only if derivable from a visible size."),
  waist_in: z.number().int().nullable().describe("Waist in inches for bottoms, only if printed."),
  condition: z.enum(CONDITIONS),
  condition_notes: z.string().nullable().describe("Visible wear, marks, pilling, or 'no visible defects'."),
  tag_price_gbp: z.number().nullable().describe("Price printed on the shop's swing tag / sticker, if legible. Else null."),
  suggested_price_gbp: z.number().describe("Your estimate of a fair UK charity-shop price in GBP."),
  code: z.string().nullable().describe("Any SKU / item code / barcode number printed on the tag."),
  silhouette: z.string().nullable().describe("fitted, relaxed, boxy, oversized, a-line, straight, etc."),
  tags: z.array(z.string()).describe("5-10 lowercase search keywords: style, occasion, season, era."),
  confidence: z.object({
    overall: z.number(),
    category: z.number(),
    colour: z.number(),
    size: z.number(),
    brand: z.number(),
    condition: z.number(),
    price_tag: z.number(),
  }).describe("0 to 1 per field. Use 0 for fields you set to null."),
});

export type GarmentAnalysis = z.infer<typeof GarmentAnalysisSchema>;

/** Cheap signals computed in the browser, used by the fallback analyser. */
export interface ClientHints {
  colour?: string;       // nearest palette colour of the garment pixels
  aspect?: number;       // crop height / width
  barcode?: string | null; // decoded by BarcodeDetector, if any
}

export interface AnalysisResult {
  analysis: GarmentAnalysis;
  model: string;         // 'claude-opus-5' | 'fallback'
  fallbackReason?: string;
}

// The API receives enums as guidance, not hard constraints, so normalise the
// model's JSON onto the storefront's vocabulary instead of failing the scan.
const pick = <T extends string>(allowed: readonly T[], v: unknown, fallback: T): T => {
  const s = String(v ?? "").toLowerCase().trim().replace(/[&'’]/g, "").replace(/[\s_]+/g, "-").replace(/-+/g, "-");
  return (allowed.find((a) => a === s || a.replace(/_/g, "-") === s || s.startsWith(a)) ?? fallback);
};
const num = (v: unknown, d: number) => (typeof v === "number" && Number.isFinite(v) ? v : d);

export function coerceAnalysis(raw: Record<string, unknown>): GarmentAnalysis {
  const conf = (raw.confidence ?? {}) as Record<string, unknown>;
  const cats = CATEGORIES as readonly string[];
  const alpha = String(raw.size_alpha ?? "").toUpperCase().trim();
  return GarmentAnalysisSchema.parse({
    ...raw,
    department: pick(DEPARTMENTS, raw.department, "unisex"),
    category: pick(cats, raw.category, "tops"),
    colour: pick(COLOURS, raw.colour, "multi"),
    condition: pick(CONDITIONS.map((c) => c.replace(/_/g, "-")), raw.condition, "good").replace(/-/g, "_"),
    size_alpha: (ALPHA_SIZES as readonly string[]).includes(alpha) ? alpha : null,
    waist_in: typeof raw.waist_in === "number" ? Math.round(raw.waist_in) : null,
    secondary_colours: Array.isArray(raw.secondary_colours) ? raw.secondary_colours.map(String) : [],
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : [],
    tag_price_gbp: typeof raw.tag_price_gbp === "number" ? raw.tag_price_gbp : null,
    suggested_price_gbp: num(raw.suggested_price_gbp, 5),
    confidence: Object.fromEntries(
      ["overall", "category", "colour", "size", "brand", "condition", "price_tag"].map((k) => [k, Math.min(1, Math.max(0, num(conf[k], 0.5)))]),
    ),
  });
}
