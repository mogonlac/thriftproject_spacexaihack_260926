import { MODEL, runAssistant, type ChatTurn, type ShopperProfile } from "@/lib/ai/assistant";
import { repo } from "@/lib/data";
import { ALPHA_SIZES, type AlphaSize } from "@/lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Body {
  messages?: { role?: string; text?: string }[];
  profile?: { department?: string | null; size?: string | null; waist?: number | null };
  sessionId?: string;
}

export async function POST(req: Request) {
  if (!process.env.GEMINI_API_KEY) {
    return Response.json({ error: "not_configured" }, { status: 503 });
  }

  const body = (await req.json().catch(() => ({}))) as Body;
  const history: ChatTurn[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.text === "string" && m.text.trim())
    .slice(-10)
    .map((m) => ({ role: m.role as ChatTurn["role"], text: m.text!.slice(0, 1000) }));

  const last = history.at(-1);
  if (!last || last.role !== "user") return Response.json({ error: "No question" }, { status: 400 });

  const p = body.profile ?? {};
  const profile: ShopperProfile = {
    department: p.department === "womens" || p.department === "mens" ? p.department : null,
    size: ALPHA_SIZES.includes(p.size as AlphaSize) ? (p.size as AlphaSize) : null,
    waist: typeof p.waist === "number" ? p.waist : null,
  };

  const started = Date.now();
  try {
    const result = await runAssistant(history, profile);
    await repo.logAi({
      session_id: body.sessionId?.slice(0, 64) ?? null,
      user_message: last.text,
      tool_calls: result.toolCalls,
      item_ids: result.items.map((i) => i.id),
      reply: result.reply,
      model: result.model,
      latency_ms: Date.now() - started,
    });
    return Response.json({ reply: result.reply, items: result.items });
  } catch (err) {
    console.error("assistant failed", err);
    await repo.logAi({
      session_id: body.sessionId?.slice(0, 64) ?? null,
      user_message: last.text,
      tool_calls: [{ name: "error", args: String(err).slice(0, 500) }],
      item_ids: [],
      reply: "",
      model: MODEL,
      latency_ms: Date.now() - started,
    });
    return Response.json({ error: "assistant_failed" }, { status: 502 });
  }
}
