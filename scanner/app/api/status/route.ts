import { activeModel } from "@/lib/analysis";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    store: getStore().kind,
    ai: activeModel(),
  });
}
