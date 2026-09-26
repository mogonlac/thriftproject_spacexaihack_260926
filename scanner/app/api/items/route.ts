import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit")) || 60, 200);
  try {
    return Response.json({ items: await getStore().listItems(limit) });
  } catch (err) {
    return Response.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 502 });
  }
}
