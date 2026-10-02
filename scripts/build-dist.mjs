#!/usr/bin/env node
// Builds the production static site into ./dist (the only directory deployed to S3).
//
//   pnpm build:dist                      # bucket-root hosting (default)
//   BASE_PATH=/civil pnpm build:dist     # hosted under a URL prefix
//
// Steps: Next.js static export (STATIC_EXPORT=true) -> copy apps/web/out to dist -> integrity checks.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { checkDist } from "./lib/dist-check.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "apps", "web", "out");
const dist = join(root, "dist");
const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");

if (basePath && !basePath.startsWith("/")) {
  console.error(`BASE_PATH must start with "/" (got "${basePath}")`);
  process.exit(1);
}

console.log(`Building static site (base path: "${basePath || "/"}") ...`);
rmSync(out, { recursive: true, force: true });
const build = spawnSync("pnpm", ["--filter", "@civil/web", "build"], {
  cwd: root,
  stdio: "inherit",
  env: { ...process.env, STATIC_EXPORT: "true", PAGES_BASE_PATH: basePath },
});
if (build.status !== 0) {
  console.error("Build failed.");
  process.exit(build.status ?? 1);
}
if (!existsSync(out)) {
  console.error(`Expected export output at ${out} but it does not exist.`);
  process.exit(1);
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(out, dist, { recursive: true });

const commit = spawnSync("git", ["rev-parse", "--short", "HEAD"], { cwd: root, encoding: "utf8" });
writeFileSync(
  join(dist, "build-info.json"),
  `${JSON.stringify(
    {
      app: "civil-engineering-platform",
      commit: commit.status === 0 ? commit.stdout.trim() : "unknown",
      builtAt: new Date().toISOString(),
      basePath,
    },
    null,
    2,
  )}\n`,
);

const result = checkDist(dist, { basePath });
for (const w of result.warnings) console.warn(`warning: ${w}`);
if (!result.ok) {
  for (const e of result.errors) console.error(`error: ${e}`);
  console.error("dist integrity check FAILED — nothing should be deployed.");
  process.exit(1);
}
console.log(
  `dist ready: ${result.stats.files} files, ${(result.stats.bytes / 1024 / 1024).toFixed(2)} MB — integrity checks passed.`,
);
