import { normaliseReceiptId, repo } from "@/lib/data";
import { staffAuthorised } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, ctx: RouteContext<"/api/receipts/[id]">) {
  if (!staffAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const { id } = await ctx.params;
  const receipt = await repo.getReceipt(normaliseReceiptId(id));
  if (!receipt) return Response.json({ error: "Receipt not found" }, { status: 404 });
  return Response.json({ receipt });
}
