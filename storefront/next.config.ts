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

const nextConfig: NextConfig = {
  transpilePackages: ["@thrift/shared"],
};

export default nextConfig;
