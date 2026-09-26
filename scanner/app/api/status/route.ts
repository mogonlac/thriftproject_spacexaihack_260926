import { aiConfigured } from "@/lib/analysis";
import { CLAUDE_MODEL } from "@/lib/analysis/claude";
import { getStore } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json({
    store: getStore().kind,
    ai: aiConfigured() ? CLAUDE_MODEL : "fallback",
  });
}
