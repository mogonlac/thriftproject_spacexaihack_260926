import type { Roi } from "../detector";

const MAX_ORIGINAL = 1600; // px, long edge
const MAX_CROP = 1400;

function toJpeg(canvas: HTMLCanvasElement, quality = 0.86): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("JPEG encode failed"))), "image/jpeg", quality),
  );
}

/**
 * Grab the current video frame at full resolution.
 * Returns the untouched original plus a padded crop around the garment bbox.
 */
export async function captureFrame(video: HTMLVideoElement, bbox: Roi | null, fallbackRoi: Roi) {
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) throw new Error("Camera not ready");

  const full = document.createElement("canvas");
  full.width = vw;
  full.height = vh;
  full.getContext("2d")!.drawImage(video, 0, 0);

  // Original, downscaled to a sane upload size
  const os = Math.min(1, MAX_ORIGINAL / Math.max(vw, vh));
  const orig = document.createElement("canvas");
  orig.width = Math.round(vw * os);
  orig.height = Math.round(vh * os);
  orig.getContext("2d")!.drawImage(full, 0, 0, orig.width, orig.height);

  // Crop: bbox padded by 6%, clamped to the hanger zone ± padding
  const r = bbox ?? fallbackRoi;
  const pad = 0.06;
  const x0 = Math.max(0, r.x0 - pad) * vw, x1 = Math.min(1, r.x1 + pad) * vw;
  const y0 = Math.max(0, r.y0 - pad) * vh, y1 = Math.min(1, r.y1 + pad) * vh;
  const cw = x1 - x0, ch = y1 - y0;
  const cs = Math.min(1, MAX_CROP / Math.max(cw, ch));
  const crop = document.createElement("canvas");
  crop.width = Math.round(cw * cs);
  crop.height = Math.round(ch * cs);
  crop.getContext("2d")!.drawImage(full, x0, y0, cw, ch, 0, 0, crop.width, crop.height);

  const [original, photo] = await Promise.all([toJpeg(orig, 0.82), toJpeg(crop)]);
  return { original, photo, aspect: ch / cw, full };
}

// ---- Barcode / rack QR (Chrome/Edge/Android BarcodeDetector; silently absent elsewhere) ----

interface DetectedBarcode { rawValue: string }
interface BarcodeDetectorLike { detect(src: CanvasImageSource): Promise<DetectedBarcode[]> }
declare global {
  interface Window { BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike }
}

let detector: BarcodeDetectorLike | null | undefined;
function getBarcodeDetector() {
  if (detector !== undefined) return detector;
  try {
    detector = typeof window !== "undefined" && window.BarcodeDetector
      ? new window.BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13", "ean_8", "code_39", "upc_a"] })
      : null;
  } catch {
    detector = null;
  }
  return detector;
}

export async function readCodes(src: CanvasImageSource): Promise<string[]> {
  const d = getBarcodeDetector();
  if (!d) return [];
  try {
    return (await d.detect(src)).map((c) => c.rawValue).filter(Boolean);
  } catch {
    return [];
  }
}

/** 'RACK:B3', 'rack=B3' or any URL with ?rack=B3 → 'B3' */
export function parseRackCode(value: string): string | null {
  const m = value.match(/(?:^|[^a-z])rack[:=]\s*([A-Za-z0-9-]{1,12})/i);
  return m ? m[1].toUpperCase() : null;
}
