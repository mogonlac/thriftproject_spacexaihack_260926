// Garment presence + stillness detection on a tiny downscaled frame.
//
// presence = share of pixels in the hanger zone (ROI) that differ from the
//            calibrated empty background
// motion   = share of ROI pixels that changed since the previous sample
//
// A global brightness offset (camera auto-exposure) is estimated from pixels
// outside the ROI and removed before comparing with the background.

export const DW = 64;
export const DH = 48;

export interface Roi { x0: number; y0: number; x1: number; y1: number } // fractions 0..1

export const DEFAULT_ROI: Roi = { x0: 0.2, y0: 0.04, x1: 0.8, y1: 0.96 };

const BG_DIFF = 30;     // per-channel difference that counts as "not background"
const MOTION_DIFF = 16; // luminance difference that counts as "changed"

export interface FrameStats {
  presence: number;
  motion: number;
  /** Foreground bbox in fractions of the full frame, or null if nothing present. */
  bbox: Roi | null;
  /** Mean RGB of foreground pixels. */
  fgColour: [number, number, number] | null;
}

export class GarmentDetector {
  private bg: Float32Array | null = null;
  private calib: Float32Array | null = null;
  private calibCount = 0;
  private calibTarget = 0;
  private prevLum: Float32Array | null = null;
  readonly mask = new Uint8Array(DW * DH);
  roi: Roi = DEFAULT_ROI;

  get calibrated() { return this.bg !== null && this.calibTarget === 0; }
  get calibrating() { return this.calibTarget > 0; }

  startCalibration(frames = 12) {
    this.calib = new Float32Array(DW * DH * 3);
    this.calibCount = 0;
    this.calibTarget = frames;
  }

  private inRoi(x: number, y: number) {
    const fx = (x + 0.5) / DW, fy = (y + 0.5) / DH;
    return fx >= this.roi.x0 && fx <= this.roi.x1 && fy >= this.roi.y0 && fy <= this.roi.y1;
  }

  /** Feed one RGBA frame of size DW×DH. */
  process(rgba: Uint8ClampedArray): FrameStats {
    const n = DW * DH;

    // Motion vs previous frame (luminance)
    const lum = new Float32Array(n);
    let moved = 0, roiCount = 0;
    for (let i = 0; i < n; i++) {
      const p = i * 4;
      lum[i] = 0.299 * rgba[p] + 0.587 * rgba[p + 1] + 0.114 * rgba[p + 2];
      const x = i % DW, y = (i / DW) | 0;
      if (this.inRoi(x, y)) {
        roiCount++;
        if (this.prevLum && Math.abs(lum[i] - this.prevLum[i]) > MOTION_DIFF) moved++;
      }
    }
    this.prevLum = lum;
    const motion = roiCount ? moved / roiCount : 0;

    // Calibration: average N frames of the empty scene
    if (this.calibTarget > 0 && this.calib) {
      for (let i = 0; i < n; i++) {
        this.calib[i * 3] += rgba[i * 4];
        this.calib[i * 3 + 1] += rgba[i * 4 + 1];
        this.calib[i * 3 + 2] += rgba[i * 4 + 2];
      }
      if (++this.calibCount >= this.calibTarget) {
        for (let i = 0; i < this.calib.length; i++) this.calib[i] /= this.calibCount;
        this.bg = this.calib;
        this.calib = null;
        this.calibTarget = 0;
      }
      this.mask.fill(0);
      return { presence: 0, motion, bbox: null, fgColour: null };
    }
    const bg = this.bg;
    if (!bg) return { presence: 0, motion, bbox: null, fgColour: null };

    // Exposure offset from outside the ROI
    const off = [0, 0, 0];
    let outCount = 0;
    for (let i = 0; i < n; i++) {
      const x = i % DW, y = (i / DW) | 0;
      if (this.inRoi(x, y)) continue;
      outCount++;
      for (let c = 0; c < 3; c++) off[c] += rgba[i * 4 + c] - bg[i * 3 + c];
    }
    if (outCount > 100) for (let c = 0; c < 3; c++) off[c] /= outCount;
    else off.fill(0);

    // Foreground mask inside ROI
    let fg = 0;
    const colSum = new Uint16Array(DW), rowSum = new Uint16Array(DH);
    const sum = [0, 0, 0];
    for (let i = 0; i < n; i++) {
      const x = i % DW, y = (i / DW) | 0;
      let on = 0;
      if (this.inRoi(x, y)) {
        const d = Math.max(
          Math.abs(rgba[i * 4] - bg[i * 3] - off[0]),
          Math.abs(rgba[i * 4 + 1] - bg[i * 3 + 1] - off[1]),
          Math.abs(rgba[i * 4 + 2] - bg[i * 3 + 2] - off[2]),
        );
        if (d > BG_DIFF) {
          on = 1;
          fg++;
          colSum[x]++;
          rowSum[y]++;
          sum[0] += rgba[i * 4]; sum[1] += rgba[i * 4 + 1]; sum[2] += rgba[i * 4 + 2];
        }
      }
      this.mask[i] = on;
    }
    const presence = roiCount ? fg / roiCount : 0;

    // Bbox from row/column histograms (ignores isolated noise pixels)
    let bbox: Roi | null = null;
    if (fg > 20) {
      const first = (a: Uint16Array) => a.findIndex((v) => v >= 2);
      const last = (a: Uint16Array) => { for (let i = a.length - 1; i >= 0; i--) if (a[i] >= 2) return i; return -1; };
      const x0 = first(colSum), x1 = last(colSum), y0 = first(rowSum), y1 = last(rowSum);
      if (x0 >= 0 && y0 >= 0 && x1 > x0 && y1 > y0) {
        bbox = { x0: x0 / DW, x1: (x1 + 1) / DW, y0: y0 / DH, y1: (y1 + 1) / DH };
      }
    }
    const fgColour: [number, number, number] | null = fg > 20 ? [sum[0] / fg, sum[1] / fg, sum[2] / fg] : null;
    return { presence, motion, bbox, fgColour };
  }

  /** Slowly blend the current frame into the background while the zone is empty (lighting drift). */
  adapt(rgba: Uint8ClampedArray, alpha = 0.03) {
    if (!this.bg) return;
    for (let i = 0; i < DW * DH; i++) {
      for (let c = 0; c < 3; c++) {
        this.bg[i * 3 + c] += alpha * (rgba[i * 4 + c] - this.bg[i * 3 + c]);
      }
    }
  }
}

/** Map an RGB mean to the storefront's colour vocabulary (rough; the AI refines it). */
export function nearestColourName([r, g, b]: [number, number, number]): string {
  const max = Math.max(r, g, b) / 255, min = Math.min(r, g, b) / 255;
  const l = (max + min) / 2;
  const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
  if (l < 0.16) return "black";
  if (s < 0.14) return l > 0.82 ? "white" : l > 0.3 ? "grey" : "black";
  let h = 0;
  const R = r / 255, G = g / 255, B = b / 255, d = max - min;
  if (max === R) h = ((G - B) / d) % 6;
  else if (max === G) h = (B - R) / d + 2;
  else h = (R - G) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h < 15 || h >= 340) return l > 0.7 ? "pink" : "red";
  if (h < 40) return l < 0.45 ? "brown" : s < 0.45 ? "beige" : "orange";
  if (h < 65) return s < 0.4 ? "beige" : "yellow";
  if (h < 170) return "green";
  if (h < 250) return l < 0.3 ? "navy" : "blue";
  if (h < 290) return "purple";
  return "pink";
}
