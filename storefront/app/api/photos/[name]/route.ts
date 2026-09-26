import { readPhoto } from "@thrift/shared/localDb";

export const runtime = "nodejs";

// Serves garment photos the scanner saved to the shared local store (no-Supabase mode),
// so scanned items show their pictures in the shop too.
export async function GET(_req: Request, ctx: RouteContext<"/api/photos/[name]">) {
  const { name } = await ctx.params;
  const buf = await readPhoto(name);
  if (!buf) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(buf), {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
