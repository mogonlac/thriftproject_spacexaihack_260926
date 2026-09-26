import "server-only";
import { FunctionCallingConfigMode, GoogleGenAI, ThinkingLevel, type Content, type FunctionDeclaration, type Part } from "@google/genai";
import { repo } from "../data";
import { gbp, sizeText } from "../format";
import {
  ALPHA_SIZES,
  CATEGORIES,
  COLOURS,
  CONDITIONS,
  DEPARTMENTS,
  type AlphaSize,
  type Category,
  type Colour,
  type Condition,
  type Department,
  type Item,
  type ItemQuery,
} from "../types";

// Grounded shopping assistant. The model can only *find* items through
// search_inventory and can only *show* items via show_items, whose ids are
// checked against what the searches actually returned this turn. Cards are
// rendered from the database, never from model text.

// ASSISTANT_MODEL (not GEMINI_MODEL) so it can differ from the scanner's vision model in the shared .env.
export const MODEL = process.env.ASSISTANT_MODEL || "gemini-flash-latest";
const MAX_STEPS = 5;
const MAX_SHOWN = 8;

export interface ChatTurn {
  role: "user" | "assistant";
  text: string;
}

export interface ShopperProfile {
  department?: "womens" | "mens" | null;
  size?: AlphaSize | null;
  waist?: number | null;
}

export interface AssistantResult {
  reply: string;
  items: Item[];
  toolCalls: { name: string; args: unknown; result_ids?: string[] }[];
  /** Concrete model version that answered (the env value may be an alias). */
  model: string;
}

const searchInventory: FunctionDeclaration = {
  name: "search_inventory",
  description:
    "Search the charity shop's CURRENT stock. This is the only source of truth for what exists — every item is one of a kind. " +
    "Returns up to 12 available items with id, title, size, colour, price and rack. Call it again with different filters to broaden or narrow.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Free-text keywords matched against title, description, brand, material and style tags, e.g. 'warm wool', 'party', 'leather'.",
      },
      department: { type: "string", enum: [...DEPARTMENTS], description: "Who it's for. Unisex items are always included." },
      categories: { type: "array", items: { type: "string", enum: [...CATEGORIES] } },
      sizes: { type: "array", items: { type: "string", enum: [...ALPHA_SIZES] }, description: "Normalised letter sizes." },
      waist_in: { type: "integer", description: "Waist in inches, for trousers/jeans (±1 inch)." },
      colours: { type: "array", items: { type: "string", enum: [...COLOURS] } },
      conditions: { type: "array", items: { type: "string", enum: [...CONDITIONS] } },
      max_price_gbp: { type: "number" },
      min_price_gbp: { type: "number" },
    },
  },
};

const showItems: FunctionDeclaration = {
  name: "show_items",
  description:
    "Finish your turn: show the shopper item cards (photo, price, size, rack, add button) with a short message. " +
    "item_ids MUST come from search_inventory results in this turn. Use an empty list if nothing suitable was found.",
  parametersJsonSchema: {
    type: "object",
    properties: {
      message: {
        type: "string",
        description: "1–2 friendly sentences. Do not state prices, sizes or rack numbers — the cards show them.",
      },
      item_ids: { type: "array", items: { type: "string" }, description: `Best matches first, max ${MAX_SHOWN}.` },
    },
    required: ["message", "item_ids"],
  },
};

function systemPrompt(profile: ShopperProfile): string {
  const bits: string[] = [];
  if (profile.department) bits.push(`shopping in ${profile.department === "womens" ? "womenswear" : "menswear"}`);
  if (profile.size) bits.push(`usual size ${profile.size}`);
  if (profile.waist) bits.push(`waist ${profile.waist}"`);
  return [
    "You are the friendly shopping assistant on an in-store kiosk in an Oxfam charity shop in the UK.",
    "Shoppers describe what they want; you find matching items that are on the rails right now.",
    "",
    "Rules — follow them exactly:",
    "1. Only ever recommend items returned by search_inventory in this conversation turn. Never invent items, brands, prices, sizes or rack locations.",
    "2. Always end your turn by calling show_items. Put the reply text in its message field.",
    "3. Only show items that match what the shopper asked for. Do not suggest extra or complementary items they didn't ask for.",
    "4. If a search returns nothing, try once or twice with looser filters (fewer keywords, no size, higher price). If you then show near-misses, say honestly how they differ (e.g. 'nothing under £10, but these are close').",
    "5. If nothing at all fits, call show_items with an empty list and say so kindly — stock changes daily.",
    "6. Keep messages short, warm and plain (British English). No markdown, no lists. Don't mention prices or racks in the message; the cards show them.",
    "7. Map requests to filters sensibly: 'warm' → query 'warm' plus coats/knitwear; 'under £20' → max_price_gbp 20; 'jeans 32 waist' → categories jeans + waist_in 32.",
    "8. If the request isn't about finding items in the shop, briefly say you can help find clothes and accessories in the shop, and call show_items with an empty list.",
    "",
    bits.length
      ? `Shopper profile from the welcome screen: ${bits.join(", ")}. Use these as default filters unless the shopper asks otherwise; if that finds nothing, retry without size.`
      : "The shopper hasn't set a department or size.",
  ].join("\n");
}

function toQuery(args: Record<string, unknown>): ItemQuery {
  const arr = <T extends string>(v: unknown, allowed: readonly T[]): T[] | undefined => {
    if (!Array.isArray(v)) return undefined;
    const out = v.filter((x): x is T => typeof x === "string" && (allowed as readonly string[]).includes(x));
    return out.length ? out : undefined;
  };
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
  const dept = typeof args.department === "string" && (DEPARTMENTS as readonly string[]).includes(args.department) ? (args.department as Department) : undefined;
  const waist = num(args.waist_in);
  const max = num(args.max_price_gbp);
  const min = num(args.min_price_gbp);
  return {
    text: typeof args.query === "string" ? args.query.slice(0, 200) : undefined,
    departments: dept ? (dept === "unisex" ? ["unisex"] : [dept, "unisex"]) : undefined,
    categories: arr<Category>(args.categories, CATEGORIES),
    sizes: arr<AlphaSize>(args.sizes, ALPHA_SIZES),
    colours: arr<Colour>(args.colours, COLOURS),
    conditions: arr<Condition>(args.conditions, CONDITIONS),
    waist_in: waist ? [Math.round(waist)] : undefined,
    max_price_pence: max != null ? Math.round(max * 100) : undefined,
    min_price_pence: min != null ? Math.round(min * 100) : undefined,
    statuses: ["available"],
    limit: 12,
  };
}

function compact(i: Item) {
  return {
    id: i.id,
    title: i.title,
    department: i.department,
    category: i.category,
    size: sizeText(i),
    colour: i.colour,
    brand: i.brand,
    condition: i.condition,
    price: gbp(i.price_pence),
    rack: i.rack,
    tags: i.tags,
    description: i.description,
  };
}

export async function runAssistant(history: ChatTurn[], profile: ShopperProfile): Promise<AssistantResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const ai = new GoogleGenAI({ apiKey });

  const contents: Content[] = history.map((t) => ({
    role: t.role === "assistant" ? "model" : "user",
    parts: [{ text: t.text }],
  }));

  const seen = new Set<string>();
  const toolCalls: AssistantResult["toolCalls"] = [];
  let model = MODEL;

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await ai.models.generateContent({
      model: MODEL,
      contents,
      config: {
        systemInstruction: systemPrompt(profile),
        // Tool routing doesn't need deep reasoning; low thinking keeps the kiosk snappy.
        thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        tools: [{ functionDeclarations: [searchInventory, showItems] }],
        // Last step: the model must wrap up with show_items (possibly empty).
        ...(step === MAX_STEPS - 1 && {
          toolConfig: { functionCallingConfig: { mode: FunctionCallingConfigMode.ANY, allowedFunctionNames: ["show_items"] } },
        }),
      },
    });

    if (res.modelVersion) model = res.modelVersion;
    const calls = res.functionCalls ?? [];
    if (calls.length === 0) {
      // Model answered in plain text without showing anything — allowed, but no cards.
      return { reply: res.text?.trim() || "Sorry, I didn't catch that. What are you looking for?", items: [], toolCalls, model };
    }

    // Keep the model's turn verbatim (preserves thought signatures).
    const modelContent = res.candidates?.[0]?.content;
    if (modelContent) contents.push(modelContent);

    const responses: Part[] = [];
    for (const call of calls) {
      const args = (call.args ?? {}) as Record<string, unknown>;

      if (call.name === "show_items") {
        const requested = Array.isArray(args.item_ids) ? args.item_ids.filter((x): x is string => typeof x === "string") : [];
        // Grounding guard: only ids this turn's searches returned, re-read from the DB.
        const allowed = requested.filter((id) => seen.has(id)).slice(0, MAX_SHOWN);
        const items = (await repo.getItems(allowed)).filter((i) => i.status === "available");
        toolCalls.push({ name: "show_items", args: { ...args, dropped_ids: requested.filter((id) => !seen.has(id)) }, result_ids: items.map((i) => i.id) });
        const message = typeof args.message === "string" && args.message.trim() ? args.message.trim() : "Here's what I found on the rails.";
        return { reply: message, items, toolCalls, model };
      }

      if (call.name === "search_inventory") {
        const found = await repo.searchItems(toQuery(args));
        found.forEach((i) => seen.add(i.id));
        toolCalls.push({ name: "search_inventory", args, result_ids: found.map((i) => i.id) });
        responses.push({
          functionResponse: { id: call.id, name: call.name, response: {
              count: found.length,
              items: found.map(compact),
              next:
                found.length > 0
                  ? "If these fit the request, call show_items now with the best matches."
                  : "Nothing matched. Loosen one filter and search again, or call show_items with an empty list.",
            },
          },
        });
        continue;
      }

      responses.push({ functionResponse: { id: call.id, name: call.name ?? "unknown", response: { error: "Unknown tool" } } });
    }
    contents.push({ role: "user", parts: responses });
  }

  return {
    reply: "Sorry, I got a bit lost looking for that. Could you try asking another way?",
    items: [],
    toolCalls,
    model,
  };
}
