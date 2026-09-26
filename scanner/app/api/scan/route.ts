import { randomUUID } from "crypto";
import { analyseGarment } from "@/lib/analysis";
import { analysisToItem } from "@/lib/analysis/toItem";
import type { ClientHints } from "@/lib/analysis/schema";
import { getStore, localStore } from "@/lib/store";

export const runtime = "nodejs";
export const maxDuration = 60;

// POST multipart/form-data:
//   photo     JPEG — garment crop (becomes photos[0])
//   original  JPEG — full untouched camera frame (optional)
//   rack      text — current session rack, e.g. 'B3'
//   hints     JSON — ClientHints (colour, aspect, barcode) for the fallback analyser
//   station   text — scan_source label
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return Response.json({ error: "Expected multipart form data" }, { status: 400 });
  }

  const photo = form.get("photo");
  const original = form.get("original");
  const rack = String(form.get("rack") ?? "").trim();
  const station = String(form.get("station") ?? "station-1").slice(0, 64);
  if (!(photo instanceof Blob) || photo.size === 0) {
    return Response.json({ error: "Missing photo" }, { status: 400 });
  }
  if (!rack) return Response.json({ error: "No rack selected" }, { status: 400 });

  let hints: ClientHints = {};
  try {
    hints = JSON.parse(String(form.get("hints") ?? "{}"));
  } catch {}

  const store = getStore();
  const id = randomUUID();
  const photoBuf = Buffer.from(await photo.arrayBuffer());
  const originalBuf = original instanceof Blob && original.size > 0 ? Buffer.from(await original.arrayBuffer()) : null;

  // Upload and analysis run in parallel; neither blocks the other on failure.
  const warnings: string[] = [];
  const upload = async (name: string, buf: Buffer) => {
    try {
      return await store.savePhoto(name, buf);
    } catch (err) {
      if (store.kind === "local") throw err;
      warnings.push("Photo upload failed — saved locally instead");
      console.error("[scanner] upload failed, saving locally:", err);
      return localStore.savePhoto(name, buf);
    }
  };

  try {
    const [photoUrl, originalUrl, result] = await Promise.all([
      upload(`${id}.jpg`, photoBuf),
      originalBuf ? upload(`${id}-original.jpg`, originalBuf).catch(() => null) : Promise.resolve(null),
      analyseGarment(photoBuf, hints),
    ]);

    // The AI saw no garment (empty hanger, a hand, a stray card): don't create an item.
    if (!result.analysis.is_garment && result.model !== "fallback") {
      return Response.json({ rejected: true, reason: result.analysis.description });
    }

    const item = await store.insertItem(
      analysisToItem(result, {
        rack,
        photoUrl,
        originalPhotoUrl: originalUrl,
        scanSource: station,
        barcode: hints.barcode ?? null,
      }),
    );

    if (result.fallbackReason) warnings.push(`AI fallback used: ${result.fallbackReason}`);
    return Response.json({ item, tagCrops: result.tagCrops ?? 0, store: store.kind, warnings });
  } catch (err) {
    console.error("[scanner] scan failed:", err);
    return Response.json(
      { error: err instanceof Error ? err.message : "Scan failed" },
      { status: 502 },
    );
  }
}
