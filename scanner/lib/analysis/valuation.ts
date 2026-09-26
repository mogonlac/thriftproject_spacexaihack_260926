import "server-only";
import { z } from "zod";
import type { GarmentAnalysis } from "./schema";
import { visionJson } from "./vision";

// Market valuation: Tavily web search over UK resale listings (eBay, Vinted,
// Depop…) → the model turns Tavily's summary into numbers → a charity-shop
// price derived from the typical resale price. Evidence is stored with the
// item so staff can see where the estimate came from.

export interface Valuation {
  provider: "tavily";
  query: string;
  resale_low_gbp: number | null;
  resale_typical_gbp: number | null;
  resale_high_gbp: number | null;
  suggested_gbp: number | null;   // charity-shop price derived from resale_typical
  summary: string;
  sources: { title: string; url: string }[];
  confidence: number;             // 0..1
}

const TAVILY_URL = "https://api.tavily.com/search";
const SHOP_SHARE = 0.55;          // charity shops price well under online resale (no postage, donated stock)
const CONDITION_FACTOR: Record<GarmentAnalysis["condition"], number> = {
  new_with_tags: 1.2, excellent: 1.1, good: 1, fair: 0.7,
};

export function valuationConfigured() {
  return Boolean(process.env.TAVILY_API_KEY);
}

/** Search phrase for the item, e.g. "Levi's blue denim trucker jacket". */
export function valuationQuery(a: GarmentAnalysis) {
  const what = a.subcategory || a.title;
  const words = [a.brand, a.colour !== "multi" ? a.colour : null, a.material, what]
    .filter(Boolean)
    .join(" ");
  // de-duplicate repeated words ("black Black jacket")
  const seen = new Set<string>();
  return words.split(/\s+/).filter((w) => { const k = w.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; }).join(" ");
}

const ExtractSchema = z.object({
  resale_low_gbp: z.number().nullable(),
  resale_typical_gbp: z.number().nullable().describe("The typical price a used one sells for, in GBP. Null if the text gives no usable price."),
  resale_high_gbp: z.number().nullable(),
  confidence: z.number().describe("0-1: how well the text supports these numbers for this specific item"),
});

interface TavilyResponse { answer?: string; results?: { title: string; url: string; content: string }[] }

async function searchTavily(query: string): Promise<TavilyResponse> {
  const res = await fetch(TAVILY_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.TAVILY_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, search_depth: "basic", max_results: 6, include_answer: "advanced", country: "united kingdom" }),
    signal: AbortSignal.timeout(8_000),
  });
  if (!res.ok) throw new Error(`Tavily ${res.status}`);
  return res.json();
}

/** Charity-shop style price: rounded to £0.50 steps, at least £2. */
export function shopPrice(typicalGbp: number, condition: GarmentAnalysis["condition"]) {
  const raw = typicalGbp * SHOP_SHARE * CONDITION_FACTOR[condition];
  return Math.max(2, Math.round(raw * 2) / 2);
}

export async function valueGarment(a: GarmentAnalysis): Promise<Valuation | null> {
  if (!valuationConfigured()) return null;
  const item = valuationQuery(a);
  const query = `typical second-hand resale price in GBP for a used ${item} on eBay UK, Vinted or Depop`;

  // Tavily occasionally returns no answer; one quick retry covers it.
  let data = await searchTavily(query);
  if (!data.answer?.trim()) data = await searchTavily(query);
  const summary = (data.answer ?? "").trim();
  const sources = (data.results ?? []).slice(0, 5).map((r) => ({ title: r.title, url: r.url }));
  if (!summary) return null;

  const raw = await visionJson({
    system: "You extract second-hand prices from a short market summary. Use only numbers stated in the text. Convert USD to GBP at 0.78 only if no GBP figure is given. If the summary is about a different or much more premium item than the one described, lower the confidence.",
    text: `Item: ${item}\nCondition: ${a.condition}\n\nMarket summary:\n${summary}`,
    images: [],
    schema: ExtractSchema,
    timeoutMs: 10_000,
  });
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v > 0 && v < 5000 ? v : null);
  const typical = num(raw.resale_typical_gbp);
  const confidence = Math.min(1, Math.max(0, typeof raw.confidence === "number" ? raw.confidence : 0.5));

  return {
    provider: "tavily",
    query: item,
    resale_low_gbp: num(raw.resale_low_gbp),
    resale_typical_gbp: typical,
    resale_high_gbp: num(raw.resale_high_gbp),
    suggested_gbp: typical != null ? shopPrice(typical, a.condition) : null,
    summary,
    sources,
    confidence,
  };
}
