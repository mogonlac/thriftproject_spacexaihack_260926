import { activeModel } from "@/lib/analysis";
import { valuationConfigured } from "@/lib/analysis/valuation";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    store: getStore().kind,
    ai: activeModel(),
    market: valuationConfigured(),
  });
}
