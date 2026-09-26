import { normaliseReceiptId, repo } from "@/lib/data";
import { staffAuthorised } from "@/lib/staffAuth";
import type { ReceiptOutcome } from "@/lib/types";

export const dynamic = "force-dynamic";

const OUTCOMES: ReceiptOutcome[] = ["pending", "sold", "returned"];

/** Staff: mark one receipt line sold / returned to rack (or back to pending). */
export async function POST(req: Request, ctx: RouteContext<"/api/receipts/[id]/items/[itemId]">) {
  if (!staffAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const { id, itemId } = await ctx.params;
  const { outcome } = (await req.json().catch(() => ({}))) as { outcome?: ReceiptOutcome };
  if (!outcome || !OUTCOMES.includes(outcome)) return Response.json({ error: "Bad outcome" }, { status: 400 });
  const receipt = await repo.setOutcome(normaliseReceiptId(id), itemId, outcome);
  if (!receipt) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ receipt });
}
