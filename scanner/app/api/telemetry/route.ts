import { promises as fs } from "fs";
import path from "path";

export const runtime = "nodejs";

// Dev-only diagnostics sink. When the scanner's debug mode (D key) is on, the
// browser posts detection stats here plus an occasional camera snapshot, so the
// thresholds can be tuned against the real station. Disabled in production.
const DIR = path.join(process.cwd(), "data", "debug");

export async function POST(req: Request) {
  if (process.env.NODE_ENV === "production") return new Response(null, { status: 404 });
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return new Response(null, { status: 400 });

  await fs.mkdir(DIR, { recursive: true });
  const { frame, mask, ...stats } = body;
  if (typeof frame === "string" && frame.startsWith("data:image/jpeg;base64,")) {
    await fs.writeFile(path.join(DIR, "frame.jpg"), Buffer.from(frame.split(",")[1], "base64"));
  }
  if (typeof mask === "string" && mask.startsWith("data:image/png;base64,")) {
    await fs.writeFile(path.join(DIR, "mask.png"), Buffer.from(mask.split(",")[1], "base64"));
  }
  await fs.appendFile(path.join(DIR, "telemetry.jsonl"), JSON.stringify({ at: new Date().toISOString(), ...stats }) + "\n");
  return new Response(null, { status: 204 });
}
