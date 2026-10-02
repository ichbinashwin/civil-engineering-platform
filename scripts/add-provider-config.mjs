#!/usr/bin/env node
// Renders deploy/security-headers.json into the native config of a hosting provider, next to the
// already-built dist/. Run by the provider workflows (and usable locally). No secrets are involved.
//
//   node scripts/add-provider-config.mjs <provider> [--dist dist] [--site <firebase-site>]
//
// Providers: cloudflare, netlify (dist/_headers) · azure (dist/staticwebapp.config.json)
//            vercel (.vercel/output Build Output API v3) · firebase (firebase.json)
//            none (nothing to add: s3, github-pages, gitlab, codeberg, render)
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const PROVIDERS = ["cloudflare", "netlify", "azure", "vercel", "firebase", "none"];

export function loadHeaderConfig(root = repoRoot) {
  return JSON.parse(readFileSync(join(root, "deploy", "security-headers.json"), "utf8"));
}

/** `_headers` file format shared by Cloudflare Pages and Netlify. */
export function renderUnderscoreHeaders(config) {
  const block = (path, headers) =>
    `${path}\n${Object.entries(headers)
      .map(([k, v]) => `  ${k}: ${v}`)
      .join("\n")}\n`;
  return [
    block("/*", config.headers),
    block(`${config.immutable.path}*`, { "Cache-Control": config.immutable.cacheControl }),
  ].join("\n");
}

export function renderAzureConfig(config) {
  return {
    globalHeaders: config.headers,
    routes: [
      {
        route: `${config.immutable.path}*`,
        headers: { "Cache-Control": config.immutable.cacheControl },
      },
    ],
    responseOverrides: { 404: { rewrite: "/404.html", statusCode: 404 } },
  };
}

export function renderFirebaseConfig(config, options = {}) {
  const asList = (headers) => Object.entries(headers).map(([key, value]) => ({ key, value }));
  return {
    hosting: {
      ...(options.site ? { site: options.site } : {}),
      public: options.dist ?? "dist",
      ignore: ["firebase.json", "**/.*", "**/node_modules/**"],
      cleanUrls: false,
      headers: [
        { source: "**", headers: asList(config.headers) },
        {
          source: `${config.immutable.path}**`,
          headers: [{ key: "Cache-Control", value: config.immutable.cacheControl }],
        },
      ],
    },
  };
}

/** Vercel Build Output API v3: deploy pre-built static files with `vercel deploy --prebuilt`. */
export function renderVercelOutputConfig(config) {
  return {
    version: 3,
    routes: [
      {
        src: `${config.immutable.path}(.*)`,
        headers: { "cache-control": config.immutable.cacheControl },
        continue: true,
      },
      { src: "/(.*)", headers: config.headers, continue: true },
      { handle: "filesystem" },
      { src: "/(.*)", status: 404, dest: "/404.html" },
    ],
  };
}

/**
 * @param {string} provider one of PROVIDERS
 * @param {{ root?: string, dist?: string, site?: string }} [options]
 * @returns {string[]} files written (relative to root)
 */
export function writeProviderConfig(provider, options = {}) {
  if (!PROVIDERS.includes(provider)) {
    throw new Error(`Unknown provider "${provider}". Use one of: ${PROVIDERS.join(", ")}`);
  }
  const root = options.root ?? repoRoot;
  const distName = options.dist ?? "dist";
  const dist = join(root, distName);
  const config = loadHeaderConfig(root);
  const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
  const written = [];
  const write = (file, content) => {
    mkdirSync(dirname(join(root, file)), { recursive: true });
    writeFileSync(join(root, file), content);
    written.push(file);
  };
  if (provider !== "none" && !existsSync(join(dist, "index.html"))) {
    throw new Error(`${distName}/index.html not found. Build first: pnpm build:dist`);
  }

  switch (provider) {
    case "cloudflare":
    case "netlify":
      write(`${distName}/_headers`, renderUnderscoreHeaders(config));
      break;
    case "azure":
      write(`${distName}/staticwebapp.config.json`, json(renderAzureConfig(config)));
      break;
    case "firebase":
      write(
        "firebase.json",
        json(renderFirebaseConfig(config, { dist: distName, site: options.site })),
      );
      break;
    case "vercel": {
      const out = join(root, ".vercel", "output");
      rmSync(out, { recursive: true, force: true });
      cpSync(dist, join(out, "static"), { recursive: true });
      written.push(".vercel/output/static");
      write(".vercel/output/config.json", json(renderVercelOutputConfig(config)));
      break;
    }
    default:
      break;
  }
  return written;
}

function main(argv) {
  const [provider, ...rest] = argv;
  const flag = (name) => {
    const i = rest.indexOf(name);
    return i >= 0 ? rest[i + 1] : undefined;
  };
  if (!provider) {
    console.error(
      `Usage: add-provider-config.mjs <${PROVIDERS.join("|")}> [--dist dist] [--site name]`,
    );
    process.exit(1);
  }
  try {
    const files = writeProviderConfig(provider, { dist: flag("--dist"), site: flag("--site") });
    console.log(
      files.length ? `Wrote: ${files.join(", ")}` : `No extra files needed for "${provider}".`,
    );
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url))
  main(process.argv.slice(2));
