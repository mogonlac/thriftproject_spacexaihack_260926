import "server-only";
import sharp from "sharp";
import type { GarmentAnalysis, TagRead } from "./schema";

const CONFIDENT = 0.6;
const PAD = 0.35;          // grow each box by 35% so the whole tag is in frame
const MIN_CROP_PX = 16;
const TARGET_PX = 900;     // upscale small tags to this long edge

/** A tag/label is visible but its price or size wasn't read confidently from the full shot. */
export function needsTagPass(a: GarmentAnalysis) {
  if (a.label_boxes.length === 0) return false;
  const priceMissing = a.tag_price_gbp == null || a.confidence.price_tag < CONFIDENT;
  const sizeMissing = a.size_label == null || a.confidence.size < CONFIDENT;
  return priceMissing || sizeMissing;
}

/** Cut each label box out of the full-resolution photo and enlarge it. */
export async function cropLabels(photo: Buffer, boxes: GarmentAnalysis["label_boxes"]): Promise<string[]> {
  const meta = await sharp(photo).metadata();
  const W = meta.width ?? 0, H = meta.height ?? 0;
  if (!W || !H) return [];

  const crops = await Promise.all(boxes.map(async ({ box: [y0, x0, y1, x1] }) => {
    const bw = ((x1 - x0) / 1000) * W, bh = ((y1 - y0) / 1000) * H;
    const left = Math.max(0, Math.round((x0 / 1000) * W - bw * PAD));
    const top = Math.max(0, Math.round((y0 / 1000) * H - bh * PAD));
    const width = Math.min(W - left, Math.round(bw * (1 + 2 * PAD)));
    const height = Math.min(H - top, Math.round(bh * (1 + 2 * PAD)));
    if (width < MIN_CROP_PX || height < MIN_CROP_PX) return null;
    const scale = Math.min(8, TARGET_PX / Math.max(width, height));
    const buf = await sharp(photo)
      .extract({ left, top, width, height })
      .resize(Math.round(width * scale), Math.round(height * scale), { kernel: "lanczos3" })
      .sharpen()
      .jpeg({ quality: 90 })
      .toBuffer();
    return buf.toString("base64");
  }));
  return crops.filter((c): c is string => c !== null);
}

/** Fill in / upgrade price, size, brand and code from the close-up read. */
export function mergeTagRead(a: GarmentAnalysis, t: TagRead): GarmentAnalysis {
  const out = { ...a, confidence: { ...a.confidence } };
  if (t.price_gbp != null && t.confidence.price >= CONFIDENT && t.confidence.price >= a.confidence.price_tag) {
    out.tag_price_gbp = t.price_gbp;
    out.confidence.price_tag = t.confidence.price;
  }
  if (t.size_label && t.confidence.size >= CONFIDENT && (a.size_label == null || t.confidence.size > a.confidence.size)) {
    out.size_label = t.size_label;
    out.size_alpha = t.size_alpha ?? a.size_alpha;
    out.waist_in = t.waist_in ?? a.waist_in;
    out.confidence.size = t.confidence.size;
  }
  if (t.brand && t.confidence.brand >= CONFIDENT && (a.brand == null || t.confidence.brand > a.confidence.brand)) {
    out.brand = t.brand;
    out.confidence.brand = t.confidence.brand;
  }
  out.code ??= t.code;
  return out;
}

/** Downscale for the first (whole-garment) pass: faster and cheaper, tags are read from the full-res crops. */
export async function downscale(photo: Buffer, maxPx = 1024) {
  return (await sharp(photo).resize(maxPx, maxPx, { fit: "inside", withoutEnlargement: true }).jpeg({ quality: 85 }).toBuffer())
    .toString("base64");
}
