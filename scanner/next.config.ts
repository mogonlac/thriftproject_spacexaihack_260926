import { parseEnv } from "node:util";
import fs from "node:fs";
import type { NextConfig } from "next";
import path from "node:path";

// One .env.local at the repo root serves both apps. Variables already set (shell,
// or an app-level .env.local that Next loaded first) win over the root file.
for (const file of [".env.local", ".env"]) {
  const p = path.resolve(process.cwd(), "..", file);
  if (!fs.existsSync(p)) continue;
  for (const [k, v] of Object.entries(parseEnv(fs.readFileSync(p, "utf8")))) process.env[k] ??= v;
}

// Seed stock photos live in the storefront (storefront/public/seed); proxy them so
// seed items render on the scanner's inventory screen too.
const STOREFRONT_URL = process.env.NEXT_PUBLIC_STOREFRONT_URL || "http://localhost:3000";

const nextConfig: NextConfig = {
  transpilePackages: ["@thrift/shared"],
  async rewrites() {
    return [{ source: "/seed/:path*", destination: `${STOREFRONT_URL}/seed/:path*` }];
  },
};

export default nextConfig;
