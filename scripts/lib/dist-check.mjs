// Integrity checks for the production `dist/` directory before it is served or uploaded.
// Pure Node (no dependencies). Used by scripts/build-dist.mjs, the S3 pipeline and unit tests.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

/** Files that must never be published (secrets, source control, dependencies, source maps). */
const FORBIDDEN_NAMES = [
  /^\.env(\..*)?$/,
  /^\.git(ignore|attributes)?$/,
  /^node_modules$/,
  /\.map$/i,
  /\.pem$/i,
  /^id_(rsa|ed25519|ecdsa)(\.pub)?$/,
  /\.tsbuildinfo$/,
];

/** Credential patterns that must not appear in any published text file. */
const SECRET_PATTERNS = [
  { name: "AWS access key id", pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/ },
  { name: "private key block", pattern: /-----BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/ },
  { name: "GitHub token", pattern: /\bgh[pousr]_[A-Za-z0-9]{36,}\b/ },
  { name: "Slack token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
];

const TEXT_EXTENSIONS = new Set([
  ".html",
  ".js",
  ".css",
  ".json",
  ".txt",
  ".svg",
  ".xml",
  ".webmanifest",
]);
/** Warn above this total size (bytes). */
const SIZE_WARNING_BYTES = 40 * 1024 * 1024;

function walk(root) {
  const files = [];
  const visit = (dir) => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) files.push(full);
    }
  };
  visit(root);
  return files;
}

/**
 * @param {string} root dist directory
 * @param {{ basePath?: string }} [options] URL prefix the site is served under ("" for the bucket root)
 * @returns {{ ok: boolean, errors: string[], warnings: string[], stats: { files: number, bytes: number } }}
 */
export function checkDist(root, options = {}) {
  const basePath = (options.basePath ?? "").replace(/\/$/, "");
  const errors = [];
  const warnings = [];

  if (!existsSync(root) || !statSync(root).isDirectory()) {
    return {
      ok: false,
      errors: [`dist directory not found: ${root}`],
      warnings,
      stats: { files: 0, bytes: 0 },
    };
  }

  const files = walk(root);
  const bytes = files.reduce((sum, f) => sum + statSync(f).size, 0);
  const rel = (f) => relative(root, f).split(sep).join("/");

  for (const required of ["index.html", "404.html"]) {
    const p = join(root, required);
    if (!existsSync(p) || statSync(p).size === 0) errors.push(`missing or empty ${required}`);
  }
  const staticDir = join(root, "_next", "static");
  if (!existsSync(staticDir) || !walk(staticDir).some((f) => f.endsWith(".js"))) {
    errors.push("missing _next/static JavaScript assets");
  }

  for (const f of files) {
    const name = f.split(sep).pop() ?? "";
    for (const pattern of FORBIDDEN_NAMES) {
      if (pattern.test(name)) errors.push(`forbidden file in dist: ${rel(f)}`);
    }
    if (!TEXT_EXTENSIONS.has(extname(f).toLowerCase())) continue;
    const text = readFileSync(f, "utf8");
    for (const { name: label, pattern } of SECRET_PATTERNS) {
      if (pattern.test(text)) errors.push(`possible ${label} in ${rel(f)}`);
    }
  }

  const indexPath = join(root, "index.html");
  if (existsSync(indexPath)) {
    const html = readFileSync(indexPath, "utf8");
    if (/localhost|127\.0\.0\.1/.test(html)) errors.push("index.html references localhost");
    const prefix = `${basePath}/_next/`;
    const refs = new Set();
    for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
      const url = (match[1] ?? "").split(/[?#]/)[0] ?? "";
      if (url.startsWith("/_next/") || url.startsWith(prefix)) refs.add(url);
      if (basePath && url.startsWith("/_next/")) {
        errors.push(`asset URL ${url} ignores the base path "${basePath}"`);
      }
    }
    for (const url of refs) {
      const path = url.startsWith(basePath) ? url.slice(basePath.length) : url;
      if (!existsSync(join(root, decodeURIComponent(path))))
        errors.push(`index.html references a missing file: ${url}`);
    }
    if (refs.size === 0)
      errors.push("index.html references no _next assets (is this a Next.js export?)");
  }

  if (bytes > SIZE_WARNING_BYTES) {
    warnings.push(
      `dist is ${(bytes / 1024 / 1024).toFixed(1)} MB (> ${SIZE_WARNING_BYTES / 1024 / 1024} MB)`,
    );
  }
  return { ok: errors.length === 0, errors, warnings, stats: { files: files.length, bytes } };
}
