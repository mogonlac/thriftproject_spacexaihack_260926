import { promises as fs } from "fs";
import path from "path";
import type { NextRequest } from "next/server";
import { PHOTO_DIR } from "@/lib/store/local";

export const runtime = "nodejs";

// Serves photos saved by the local (no-Supabase) store.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/photos/[name]">) {
  const { name } = await ctx.params;
  if (!/^[\w-]+\.jpg$/.test(name)) return new Response("Not found", { status: 404 });
  try {
    const buf = await fs.readFile(path.join(PHOTO_DIR, name));
    return new Response(new Uint8Array(buf), {
      headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
