import { repo } from "@/lib/data";
import { staffAuthorised } from "@/lib/staffAuth";

export const dynamic = "force-dynamic";

/** Assistant observability log: what shoppers asked, what was searched, what was shown. */
export async function GET(req: Request) {
  if (!staffAuthorised(req)) return Response.json({ error: "unauthorised" }, { status: 401 });
  const limit = Number(new URL(req.url).searchParams.get("limit") ?? 50);
  return Response.json({ logs: await repo.listAiLogs(Math.min(limit, 200)) });
}
