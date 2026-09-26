import type { AlphaSize } from "./types";
import { ALPHA_SIZES } from "./types";

export type Gender = "womens" | "mens";

export interface Measurements {
  heightCm: number;
  weightKg: number;
}

/**
 * Rough size estimate from height + weight. Deliberately simple: a BMI-ish
 * frame score nudged by height. Good enough to pre-filter a charity rail —
 * the shopper can always change it.
 */
export function estimateSize(gender: Gender, { heightCm, weightKg }: Measurements): AlphaSize {
  const bmi = weightKg / Math.pow(heightCm / 100, 2);
  // Base index into XXS..XXL from BMI.
  const bands = gender === "womens" ? [17.5, 19.5, 22, 25, 28.5, 32] : [18.5, 20.5, 23, 26, 29.5, 33];
  let idx = bands.findIndex((b) => bmi < b);
  if (idx === -1) idx = ALPHA_SIZES.length - 1;
  // Taller frames need a size up, petite frames a size down.
  const tall = gender === "womens" ? 178 : 190;
  const short = gender === "womens" ? 155 : 165;
  if (heightCm >= tall) idx += 1;
  if (heightCm <= short) idx -= 1;
  idx = Math.max(0, Math.min(ALPHA_SIZES.length - 1, idx));
  return ALPHA_SIZES[idx];
}

export const WAIST_OPTIONS = [24, 26, 28, 30, 32, 34, 36, 38, 40] as const;

export const cmToFtIn = (cm: number) => {
  const totalIn = Math.round(cm / 2.54);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
};
export const kgToStLb = (kg: number) => {
  const totalLb = Math.round(kg * 2.20462);
  return { st: Math.floor(totalLb / 14), lb: totalLb % 14 };
};
