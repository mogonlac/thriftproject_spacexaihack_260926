import type { NextRequest } from "next/server";
import { getStore } from "@/lib/store";
import { ALPHA_SIZES, CATEGORIES, COLOURS, CONDITIONS, DEPARTMENTS, type NewItem } from "@/lib/types";

export const runtime = "nodejs";

// Staff corrections from the scanner's review screen. Only these fields are editable.
const TEXT_FIELDS = ["title", "size_label", "brand", "rack"] as const;
const ENUM_FIELDS = {
  category: CATEGORIES, colour: COLOURS, condition: CONDITIONS, department: DEPARTMENTS, size_alpha: ALPHA_SIZES,
} as const;

export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};

  for (const f of TEXT_FIELDS) {
    if (typeof body[f] === "string") patch[f] = (body[f] as string).trim() || null;
  }
  if (patch.title === null || patch.rack === null) {
    return Response.json({ error: "title and rack cannot be empty" }, { status: 400 });
  }
  for (const [f, allowed] of Object.entries(ENUM_FIELDS)) {
    if (body[f] === null && f === "size_alpha") patch[f] = null;
    else if ((allowed as readonly string[]).includes(body[f] as string)) patch[f] = body[f];
  }
  if (typeof body.price_pence === "number" && Number.isFinite(body.price_pence) && body.price_pence >= 0) {
    patch.price_pence = Math.round(body.price_pence);
    patch.price_source = "staff";
  }
  if (body.waist_in === null) patch.waist_in = null;
  else if (typeof body.waist_in === "number" && Number.isInteger(body.waist_in) && body.waist_in >= 18 && body.waist_in <= 60) {
    patch.waist_in = body.waist_in;
  }
  if (typeof body.needs_review === "boolean") patch.needs_review = body.needs_review;

  try {
    return Response.json({ item: await getStore().updateItem(id, patch as Partial<NewItem>) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Update failed" }, { status: 502 });
  }
}

// Undo a bad scan (e.g. wrong item captured). Removes the record entirely.
export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/items/[id]">) {
  const { id } = await ctx.params;
  try {
    await getStore().deleteItem(id);
    return Response.json({ ok: true });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Delete failed" }, { status: 502 });
  }
}
