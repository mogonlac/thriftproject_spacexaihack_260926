import type { NextRequest } from "next/server";
import { readPhoto } from "@thrift/shared/localDb";

export const runtime = "nodejs";

// Serves photos saved by the local (no-Supabase) store in the shared .data/ folder.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/photos/[name]">) {
  const { name } = await ctx.params;
  const buf = await readPhoto(name);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
