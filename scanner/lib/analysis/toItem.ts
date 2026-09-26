import type { NewItem } from "../types";
import type { AnalysisResult } from "./schema";

const TAG_PRICE_MIN_CONFIDENCE = 0.6;
const MARKET_MIN_CONFIDENCE = 0.4;
const REVIEW_BELOW_CONFIDENCE = 0.5;

const toPence = (gbp: number) => Math.max(0, Math.round(gbp * 100));

// Generic 3D template ids a future mannequin renderer can map to meshes.
const TEMPLATE_BY_CATEGORY: Record<string, string> = {
  "coats-jackets": "jacket", knitwear: "jumper", tops: "top", "t-shirts": "tshirt", shirts: "shirt",
  dresses: "dress", skirts: "skirt", trousers: "trousers", jeans: "trousers", shorts: "shorts",
};

export function analysisToItem(
  { analysis: a, model, valuation }: AnalysisResult,
  ctx: { rack: string; photoUrls: string[]; originalPhotoUrl: string | null; scanSource: string; barcode: string | null },
): NewItem {
  const c = a.confidence;
  const tagPrice = a.tag_price_gbp != null && a.tag_price_gbp > 0 && c.price_tag >= TAG_PRICE_MIN_CONFIDENCE
    ? a.tag_price_gbp
    : null;
  // Market-based price beats the model's own guess when the evidence is decent.
  const market = valuation?.suggested_gbp != null && valuation.confidence >= MARKET_MIN_CONFIDENCE ? valuation.suggested_gbp : null;
  const suggested = toPence(market ?? (a.suggested_price_gbp > 0 ? a.suggested_price_gbp : 5));

  return {
    sku: null,
    title: a.title.trim() || "Unnamed item",
    description: [a.description, a.condition_notes].filter(Boolean).join(" ") || null,
    department: a.department,
    category: a.category,
    size_label: a.size_label?.trim() || null,
    size_alpha: a.size_alpha,
    waist_in: a.waist_in,
    colour: a.colour,
    brand: a.brand?.trim() || null,
    material: a.material,
    condition: a.condition,
    // price_pence is NOT NULL in the shared schema: a read tag price wins,
    // otherwise the AI suggestion is used and flagged via price_source.
    price_pence: tagPrice != null ? toPence(tagPrice) : suggested,
    suggested_price_pence: suggested,
    rack: ctx.rack,
    photos: ctx.photoUrls,
    tags: Array.from(new Set(a.tags.map((t) => t.toLowerCase().trim()).filter(Boolean))).slice(0, 12),
    status: "available",

    price_source: tagPrice != null ? "tag" : "ai_suggested",
    needs_review: model === "fallback" || !a.is_garment || c.overall < REVIEW_BELOW_CONFIDENCE || tagPrice == null,
    original_photo_url: ctx.originalPhotoUrl,
    subcategory: a.subcategory,
    secondary_colours: a.secondary_colours,
    pattern: a.pattern,
    barcode: ctx.barcode ?? a.code,
    ai_confidence: c,
    ai_model: model,
    scan_source: ctx.scanSource,
    silhouette: a.silhouette,
    three_d_template_type: TEMPLATE_BY_CATEGORY[a.category] ?? null,
    three_d_asset_url: null,
    valuation: valuation ?? null,
  };
}
