import { repo } from "@/lib/data";
import { staffAuthorised } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

/** Staff: full inventory including sold items. */
export async function GET(req: Request) {
  if (!staffAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  return Response.json({ items: await repo.listAllItems() });
}
