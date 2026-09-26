import type { Item, ItemQuery } from "./types";
import { CATEGORY_LABELS } from "./types";

// Shared matcher used by the browse grid (client) and the AI search tool (server),
// so the assistant sees exactly what a shopper would see with the same filters.

const SYNONYMS: Record<string, string[]> = {
  jumper: ["knitwear", "sweater", "knit", "jumper", "pullover"],
  sweater: ["knitwear", "sweater", "knit", "jumper"],
  knit: ["knitwear", "knit", "jumper"],
  cardigan: ["knitwear", "cardigan"],
  coat: ["coat", "jacket", "parka", "coats"],
  jacket: ["jacket", "coat", "coats"],
  trainer: ["trainer", "sneaker", "shoe"],
  sneaker: ["trainer", "sneaker", "shoe"],
  shoe: ["shoe", "trainer", "heel", "boot"],
  heel: ["heel", "court"],
  trouser: ["trouser", "pant", "jean"],
  pant: ["trouser", "pant", "jean"],
  tee: ["tee", "t-shirt"],
  tshirt: ["tee", "t-shirt"],
  bag: ["bag", "handbag", "tote"],
  handbag: ["bag", "handbag", "tote"],
  dress: ["dress", "frock"],
  cosy: ["cosy", "cozy", "warm"],
  cozy: ["cosy", "cozy", "warm"],
  warm: ["warm", "winter", "cosy"],
  party: ["party", "occasion", "evening", "going out"],
  wedding: ["wedding", "occasion"],
  women: ["womens"],
  womens: ["womens"],
  woman: ["womens"],
  ladies: ["womens"],
  men: ["mens"],
  mens: ["mens"],
  man: ["mens"],
};

const STOP = new Set(["a", "an", "the", "for", "with", "and", "or", "in", "of", "to", "me", "i", "want", "some", "something", "under", "below", "size", "my", "please", "looking"]);

function norm(word: string): string {
  let w = word.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (w.length > 3 && w.endsWith("es") && !w.endsWith("ses")) w = w.slice(0, -1);
  if (w.length > 3 && w.endsWith("s") && !w.endsWith("ss")) w = w.slice(0, -1);
  return w;
}

export function tokenize(text: string): string[] {
  return text
    .split(/[\s,/]+/)
    .map(norm)
    .filter((w) => w && !STOP.has(w) && !/^£?\d/.test(w));
}

function haystack(item: Item): string {
  return [
    item.title,
    item.description,
    item.brand,
    item.material,
    item.colour,
    item.category,
    CATEGORY_LABELS[item.category],
    item.department,
    item.size_label,
    ...item.tags,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** 0 = no match. Higher is better. Empty text matches everything with score 1. */
export function textScore(item: Item, text: string | undefined): number {
  const tokens = text ? tokenize(text) : [];
  if (tokens.length === 0) return 1;
  const hay = haystack(item);
  let score = 0;
  for (const t of tokens) {
    const alts = SYNONYMS[t] ?? [t];
    if (hay.includes(t)) score += 2;
    else if (alts.some((a) => hay.includes(a))) score += 1;
  }
  return score;
}

export function passesFilters(item: Item, q: ItemQuery): boolean {
  if (q.statuses?.length && !q.statuses.includes(item.status)) return false;
  if (q.departments?.length && !q.departments.includes(item.department)) return false;
  if (q.categories?.length && !q.categories.includes(item.category)) return false;
  // Items without an alpha size (bags, shoes, one-size) pass size filters.
  if (q.sizes?.length && item.size_alpha && !q.sizes.includes(item.size_alpha)) return false;
  if (q.waist_in?.length && item.waist_in != null && !q.waist_in.some((w) => Math.abs(w - item.waist_in!) <= 1)) return false;
  if (q.colours?.length && !q.colours.includes(item.colour)) return false;
  if (q.conditions?.length && !q.conditions.includes(item.condition)) return false;
  if (q.min_price_pence != null && item.price_pence < q.min_price_pence) return false;
  if (q.max_price_pence != null && item.price_pence > q.max_price_pence) return false;
  return true;
}

export function searchItems(items: Item[], q: ItemQuery): Item[] {
  const scored = items
    .filter((i) => passesFilters(i, q))
    .map((i) => ({ i, s: textScore(i, q.text) }))
    .filter((x) => x.s > 0);
  const tokenCount = q.text ? tokenize(q.text).length : 0;
  // For multi-word queries, prefer items matching most words; drop weak partial hits
  // if strong ones exist.
  const best = Math.max(0, ...scored.map((x) => x.s));
  const threshold = tokenCount > 1 && best >= tokenCount ? Math.ceil(best / 2) : 1;
  return scored
    .filter((x) => x.s >= threshold)
    .sort((a, b) => b.s - a.s || b.i.created_at.localeCompare(a.i.created_at))
    .slice(0, q.limit ?? 500)
    .map((x) => x.i);
}
