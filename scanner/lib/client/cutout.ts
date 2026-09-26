// Product-style cutout using the calibrated empty-station photo.
//
// The station has a fixed camera and plain background, so "garment" is simply
// "pixels that differ from the empty shot". The mask is cleaned up (specks
// removed, gaps closed, interior holes filled so garment areas that happen to
// match the wall colour survive), feathered, and the garment is placed on an
// off-white studio background with a soft shadow. If the mask looks wrong the
// caller keeps the plain crop instead.

export interface Rect { x: number; y: number; w: number; h: number }

const MASK_MAX = 360;   // mask resolution (long edge); upscaled + feathered afterwards
const STRONG = 40;      // colour distance that is certainly garment
const WEAK = 16;        // faint difference kept only if connected to certain garment
const STUDIO = "#f2f1ee";

export function makeCutout(frame: HTMLCanvasElement, background: HTMLCanvasElement, r: Rect, outW: number, outH: number): HTMLCanvasElement | null {
  if (background.width !== frame.width || background.height !== frame.height) return null;

  // 1. Low-res copies of the same region from the live frame and the empty shot
  const s = Math.min(1, MASK_MAX / Math.max(r.w, r.h));
  const mw = Math.max(8, Math.round(r.w * s)), mh = Math.max(8, Math.round(r.h * s));
  const read = (src: HTMLCanvasElement) => {
    const c = document.createElement("canvas");
    c.width = mw;
    c.height = mh;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    g.drawImage(src, r.x, r.y, r.w, r.h, 0, 0, mw, mh);
    return g.getImageData(0, 0, mw, mh).data;
  };
  const cur = read(frame), bg = read(background);
  const n = mw * mh;

  // 2. Exposure offset from the border ring (mostly wall)
  const off = [0, 0, 0];
  let cnt = 0;
  const ring = Math.max(2, Math.round(Math.min(mw, mh) * 0.04));
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) {
    if (x >= ring && x < mw - ring && y >= ring && y < mh - ring) continue;
    const i = (y * mw + x) * 4;
    for (let c = 0; c < 3; c++) off[c] += cur[i + c] - bg[i + c];
    cnt++;
  }
  for (let c = 0; c < 3; c++) off[c] /= cnt || 1;

  // 3. Hysteresis mask: grow from certain-garment pixels through faint ones, so
  //    low-contrast parts (pale shoulders on a pale wall) stay attached.
  const dist = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p * 4;
    const dr = cur[i] - bg[i] - off[0], dg = cur[i + 1] - bg[i + 1] - off[1], db = cur[i + 2] - bg[i + 2] - off[2];
    dist[p] = Math.sqrt(dr * dr + dg * dg + db * db);
  }
  let mask = new Uint8Array(n);
  const grow: number[] = [];
  for (let p = 0; p < n; p++) if (dist[p] > STRONG) { mask[p] = 1; grow.push(p); }
  while (grow.length) {
    const i = grow.pop()!;
    const x = i % mw, y = (i / mw) | 0;
    for (const j of [x > 0 ? i - 1 : -1, x < mw - 1 ? i + 1 : -1, y > 0 ? i - mw : -1, y < mh - 1 ? i + mw : -1]) {
      if (j >= 0 && !mask[j] && dist[j] > WEAK) { mask[j] = 1; grow.push(j); }
    }
  }

  // 4. Clean: open (drop specks) then close (bridge small gaps)
  mask = dilate(erode(mask, mw, mh), mw, mh);
  mask = erode(dilate(dilate(mask, mw, mh), mw, mh), mw, mh);
  mask = erode(mask, mw, mh);

  // 5. Keep the largest blob (the garment + hanger), then fill interior holes
  mask = largestComponent(mask, mw, mh);
  mask = fillHoles(mask, mw, mh);

  // 6. Sanity check — a bad mask is worse than no cutout
  let area = 0;
  for (let p = 0; p < n; p++) area += mask[p];
  const frac = area / n;
  if (frac < 0.08 || frac > 0.92) return null;

  // 7. Mask → feathered alpha at output size
  const mc = document.createElement("canvas");
  mc.width = mw;
  mc.height = mh;
  const mg = mc.getContext("2d")!;
  const img = mg.createImageData(mw, mh);
  for (let p = 0; p < n; p++) img.data[p * 4 + 3] = mask[p] ? 255 : 0;
  mg.putImageData(img, 0, 0);

  const alpha = document.createElement("canvas");
  alpha.width = outW;
  alpha.height = outH;
  const ag = alpha.getContext("2d")!;
  ag.imageSmoothingQuality = "high";
  ag.filter = `blur(${Math.max(1, Math.round(outW / mw))}px)`;
  ag.drawImage(mc, 0, 0, outW, outH);

  // 8. Garment pixels × alpha
  const garment = document.createElement("canvas");
  garment.width = outW;
  garment.height = outH;
  const gg = garment.getContext("2d")!;
  gg.drawImage(frame, r.x, r.y, r.w, r.h, 0, 0, outW, outH);
  gg.globalCompositeOperation = "destination-in";
  gg.drawImage(alpha, 0, 0);

  // 9. Studio background + soft shadow
  const out = document.createElement("canvas");
  out.width = outW;
  out.height = outH;
  const og = out.getContext("2d")!;
  og.fillStyle = STUDIO;
  og.fillRect(0, 0, outW, outH);
  og.shadowColor = "rgba(0,0,0,0.16)";
  og.shadowBlur = Math.round(outW * 0.025);
  og.shadowOffsetY = Math.round(outH * 0.008);
  og.drawImage(garment, 0, 0);
  return out;
}

function erode(m: Uint8Array, w: number, h: number) {
  const o = new Uint8Array(m.length);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x;
    o[i] = m[i] & m[i - 1] & m[i + 1] & m[i - w] & m[i + w];
  }
  return o;
}

function dilate(m: Uint8Array, w: number, h: number) {
  const o = new Uint8Array(m.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x;
    o[i] = m[i] | (x > 0 ? m[i - 1] : 0) | (x < w - 1 ? m[i + 1] : 0) | (y > 0 ? m[i - w] : 0) | (y < h - 1 ? m[i + w] : 0);
  }
  return o;
}

function largestComponent(m: Uint8Array, w: number, h: number) {
  const label = new Int32Array(m.length);
  const stack: number[] = [];
  let best = 0, bestSize = 0, next = 0;
  for (let s = 0; s < m.length; s++) {
    if (!m[s] || label[s]) continue;
    next++;
    let size = 0;
    stack.push(s);
    label[s] = next;
    while (stack.length) {
      const i = stack.pop()!;
      size++;
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && m[j] && !label[j]) { label[j] = next; stack.push(j); }
      }
    }
    if (size > bestSize) { bestSize = size; best = next; }
  }
  const o = new Uint8Array(m.length);
  for (let i = 0; i < m.length; i++) o[i] = label[i] === best && best > 0 ? 1 : 0;
  return o;
}

/** Background = empty pixels reachable from the crop border; everything else is garment. */
function fillHoles(m: Uint8Array, w: number, h: number) {
  const outside = new Uint8Array(m.length);
  const stack: number[] = [];
  const seed = (i: number) => { if (!m[i] && !outside[i]) { outside[i] = 1; stack.push(i); } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w, y = (i / w) | 0;
    if (x > 0) seed(i - 1);
    if (x < w - 1) seed(i + 1);
    if (y > 0) seed(i - w);
    if (y < h - 1) seed(i + w);
  }
  // Only fill small holes (wall-coloured patches inside the garment); keep large
  // enclosed gaps such as the triangle under the hanger as background.
  const o = new Uint8Array(m.length);
  const seen = new Uint8Array(m.length);
  const maxHole = m.length * 0.04;
  for (let s = 0; s < m.length; s++) {
    if (m[s]) { o[s] = 1; continue; }
    if (outside[s] || seen[s]) continue;
    const hole: number[] = [];
    stack.push(s);
    seen[s] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      hole.push(i);
      const x = i % w, y = (i / w) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !m[j] && !outside[j] && !seen[j]) { seen[j] = 1; stack.push(j); }
      }
    }
    if (hole.length < maxHole) for (const i of hole) o[i] = 1;
  }
  return o;
}
