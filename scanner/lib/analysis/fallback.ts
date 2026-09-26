import { COLOURS, type Colour } from "../types";
import type { ClientHints, GarmentAnalysis } from "./schema";

// FALLBACK ANALYSER — used only when the AI provider is unavailable or
// disabled (ANALYSIS_PROVIDER=fallback). It never pretends to know things:
// everything is low-confidence and the item is flagged needs_review.
export function fallbackAnalysis(hints: ClientHints): GarmentAnalysis {
  const colour: Colour = (COLOURS as readonly string[]).includes(hints.colour ?? "")
    ? (hints.colour as Colour)
    : "multi";
  const tall = (hints.aspect ?? 1) > 1.7;
  const colourWord = colour === "multi" ? "Multicolour" : colour[0].toUpperCase() + colour.slice(1);

  return {
    is_garment: true,
    title: `${colourWord} ${tall ? "long garment" : "garment"}`,
    description: "Captured by the scanner; details need checking by staff.",
    department: "unisex",
    category: tall ? "dresses" : "tops",
    subcategory: null,
    colour,
    secondary_colours: [],
    pattern: null,
    material: null,
    brand: null,
    size_label: null,
    size_alpha: null,
    waist_in: null,
    condition: "good",
    condition_notes: null,
    tag_price_gbp: null,
    suggested_price_gbp: 5,
    code: hints.barcode ?? null,
    silhouette: null,
    tags: [colour, "needs-review"],
    label_boxes: [],
    confidence: { overall: 0.1, category: 0.1, colour: 0.4, size: 0, brand: 0, condition: 0.1, price_tag: 0 },
  };
}
