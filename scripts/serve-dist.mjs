#!/usr/bin/env node
// Serves ./dist the way S3 + CloudFront would, to verify the production build locally.
//
//   pnpm serve:dist                 # http://127.0.0.1:8080
//   PORT=9000 pnpm serve:dist
//   BASE_PATH=/civil pnpm serve:dist   # when dist was built with BASE_PATH
//
// Same behaviour as the deployed site: no server-side code, "/" -> index.html, folder URLs -> index.html,
// unknown paths -> 404.html with status 404, long immutable caching for hashed assets, no-cache for HTML.
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, normalize, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".map": "application/json",
  ".xml": "application/xml",
  ".webmanifest": "application/manifest+json",
};

const IMMUTABLE = "public, max-age=31536000, immutable";
const NO_CACHE = "no-cache";

/** Response headers CloudFront should also send (S3 website hosting cannot): see docs/deployment/aws-s3.md. */
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
};

/** Maps a URL path to a file inside root, or null. Blocks path traversal. */
export function resolveFile(root, urlPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(urlPath);
  } catch {
    return null;
  }
  if (decoded.includes("\0")) return null;
  const target = normalize(join(root, decoded));
  if (target !== root && !target.startsWith(root + sep)) return null;
  const candidates = [target, join(target, "index.html"), `${target}.html`];
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** @param {string} dist @param {{ basePath?: string }} [options] */
export function createDistServer(dist, options = {}) {
  const root = resolve(dist);
  const basePath = (options.basePath ?? "").replace(/\/$/, "");

  return createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    let pathname = url.pathname;
    const send = (status, file) => {
      const headers = { ...SECURITY_HEADERS };
      headers["Content-Type"] = MIME[extname(file).toLowerCase()] ?? "application/octet-stream";
      const isHashedAsset = file.includes(`${sep}_next${sep}static${sep}`);
      headers["Cache-Control"] = isHashedAsset ? IMMUTABLE : NO_CACHE;
      res.writeHead(status, headers);
      if (req.method === "HEAD") return res.end();
      createReadStream(file).pipe(res);
    };
    const notFound = () => {
      const page = join(root, "404.html");
      if (existsSync(page)) return send(404, page);
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      res.end("404 Not Found");
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      res.writeHead(405, { Allow: "GET, HEAD" });
      return res.end();
    }
    if (basePath) {
      if (pathname !== basePath && !pathname.startsWith(`${basePath}/`)) return notFound();
      pathname = pathname.slice(basePath.length) || "/";
    }
    const file = resolveFile(root, pathname);
    if (!file) return notFound();
    send(200, file);
  });
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
  const dist = join(root, "dist");
  if (!existsSync(join(dist, "index.html"))) {
    console.error(
      "dist/index.html not found. Run `pnpm build:dist` first (or `pnpm verify:dist`).",
    );
    process.exit(1);
  }
  const port = Number(process.env.PORT ?? 8080);
  const basePath = (process.env.BASE_PATH ?? "").replace(/\/$/, "");
  const server = createDistServer(dist, { basePath });
  server.listen(port, "127.0.0.1", () => {
    console.log(
      `Serving dist/ (production build, static files only) at http://127.0.0.1:${port}${basePath || ""}/`,
    );
    console.log("Press Ctrl+C to stop.");
  });
  const stop = () => server.close(() => process.exit(0));
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
