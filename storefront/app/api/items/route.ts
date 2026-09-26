import { repo } from "@/lib/data";

export const dynamic = "force-dynamic";

/** Shop-visible items (available + on a receipt). Used for polling when Realtime isn't configured. */
export async function GET() {
  const items = await repo.listShopItems();
  return Response.json({ items }, { headers: { "Cache-Control": "no-store" } });
}
