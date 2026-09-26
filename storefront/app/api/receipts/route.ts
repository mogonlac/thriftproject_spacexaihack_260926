import { repo } from "@/lib/data";
import { staffAuthorised } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

/** Create a receipt: atomically moves items from available -> on_receipt. */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { itemIds?: unknown } | null;
  const itemIds = Array.isArray(body?.itemIds) ? body.itemIds.filter((x): x is string => typeof x === "string") : [];
  if (itemIds.length === 0) return Response.json({ error: "No items" }, { status: 400 });
  if (itemIds.length > 30) return Response.json({ error: "Too many items" }, { status: 400 });

  const result = await repo.createReceipt(itemIds);
  if (!result.ok) return Response.json({ error: "Some items are no longer available", unavailable: result.unavailable }, { status: 409 });
  return Response.json({ receipt: result.receipt }, { status: 201 });
}

export async function GET(req: Request) {
  if (!staffAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 20);
  return Response.json({ receipts: await repo.listReceipts(Math.min(limit, 100)) });
}
