import { normaliseReceiptId, repo } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  const { id } = await ctx.params;
  const receipt = await repo.getReceipt(normaliseReceiptId(id));
  if (!receipt) return Response.json({ error: "Receipt not found" }, { status: 404 });
  return Response.json({ receipt });
}
