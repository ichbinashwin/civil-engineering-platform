import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Server } from "node:http";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { checkDist } from "../../scripts/lib/dist-check.mjs";
import { createDistServer, resolveFile } from "../../scripts/serve-dist.mjs";

let dir: string;

/** Minimal valid Next.js-like export. */
function writeValidDist(root: string, basePath = "") {
  mkdirSync(join(root, "_next", "static", "chunks"), { recursive: true });
  writeFileSync(join(root, "_next", "static", "chunks", "app.abc123.js"), "console.log('app');");
  writeFileSync(join(root, "_next", "static", "chunks", "style.abc123.css"), "body{}");
  writeFileSync(
    join(root, "index.html"),
    `<!doctype html><html><head><link rel="stylesheet" href="${basePath}/_next/static/chunks/style.abc123.css"></head><body><script src="${basePath}/_next/static/chunks/app.abc123.js"></script></body></html>`,
  );
  writeFileSync(join(root, "404.html"), "<html><body>Not found page</body></html>");
  writeFileSync(join(root, "icon.svg"), "<svg xmlns='http://www.w3.org/2000/svg'/>");
  mkdirSync(join(root, "about"), { recursive: true });
  writeFileSync(join(root, "about", "index.html"), "<html>about</html>");
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "dist-test-"));
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("dist integrity check", () => {
  it("accepts a valid export", () => {
    writeValidDist(dir);
    const r = checkDist(dir);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.stats.files).toBeGreaterThan(3);
  });

  it("fails when the directory or index.html is missing", () => {
    expect(checkDist(join(dir, "nope")).ok).toBe(false);
    mkdirSync(join(dir, "_next", "static"), { recursive: true });
    const r = checkDist(dir);
    expect(r.errors.join("\n")).toMatch(/index\.html/);
  });

  it.each([".env", ".env.production", "secrets.pem", "app.js.map", "id_rsa"])(
    "rejects forbidden file %s",
    (name) => {
      writeValidDist(dir);
      writeFileSync(join(dir, name), "x");
      const r = checkDist(dir);
      expect(r.ok).toBe(false);
      expect(r.errors.join("\n")).toContain(name);
    },
  );

  it("detects credentials in published files", () => {
    writeValidDist(dir);
    writeFileSync(
      join(dir, "_next", "static", "chunks", "leak.js"),
      'const k="AKIAABCDEFGHIJKLMNOP";',
    );
    expect(checkDist(dir).errors.join("\n")).toMatch(/AWS access key/);
    writeFileSync(join(dir, "key.txt"), "-----BEGIN RSA PRIVATE KEY-----\nabc");
    expect(checkDist(dir).errors.join("\n")).toMatch(/private key/);
  });

  it("detects references to missing assets and localhost", () => {
    writeValidDist(dir);
    writeFileSync(
      join(dir, "index.html"),
      '<html><script src="/_next/static/chunks/missing.js"></script><a href="http://localhost:3000">x</a></html>',
    );
    const text = checkDist(dir).errors.join("\n");
    expect(text).toMatch(/missing file/);
    expect(text).toMatch(/localhost/);
  });

  it("checks that asset URLs honour the base path", () => {
    writeValidDist(dir, "/civil");
    expect(checkDist(dir, { basePath: "/civil" }).ok).toBe(true);
    writeValidDist(dir, "");
    expect(checkDist(dir, { basePath: "/civil" }).errors.join("\n")).toMatch(
      /ignores the base path/,
    );
  });
});

describe("local dist server (S3 / CloudFront behaviour)", () => {
  let server: Server;
  let base: string;

  const start = async (options?: { basePath?: string }) => {
    server = createDistServer(dir, options);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  };
  afterEach(async () => {
    if (server) await new Promise((resolve) => server.close(resolve));
  });

  it("serves index.html at / and folder URLs, with the right content types", async () => {
    writeValidDist(dir);
    await start();
    const root = await fetch(`${base}/`);
    expect(root.status).toBe(200);
    expect(root.headers.get("content-type")).toMatch(/text\/html/);
    expect((await fetch(`${base}/about`)).status).toBe(200);
    expect((await fetch(`${base}/about/`)).status).toBe(200);
    expect((await fetch(`${base}/icon.svg`)).headers.get("content-type")).toBe("image/svg+xml");
  });

  it("caches hashed assets immutably and revalidates HTML", async () => {
    writeValidDist(dir);
    await start();
    const asset = await fetch(`${base}/_next/static/chunks/app.abc123.js`);
    expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
    expect(asset.headers.get("content-type")).toMatch(/javascript/);
    expect((await fetch(`${base}/`)).headers.get("cache-control")).toBe("no-cache");
  });

  it("returns 404.html with status 404 for unknown paths", async () => {
    writeValidDist(dir);
    await start();
    const r = await fetch(`${base}/does/not/exist`);
    expect(r.status).toBe(404);
    expect(await r.text()).toContain("Not found page");
  });

  it("blocks path traversal and non-GET methods, and sends security headers", async () => {
    writeValidDist(dir);
    writeFileSync(join(dir, "..", "dist-test-secret.txt"), "secret");
    await start();
    for (const path of [
      "/../dist-test-secret.txt",
      "/%2e%2e/dist-test-secret.txt",
      "/..%2f..%2fetc/passwd",
      "/%00",
    ]) {
      const r = await fetch(`${base}${path}`);
      expect([404, 400]).toContain(r.status);
      expect(await r.text()).not.toContain("secret");
    }
    expect((await fetch(`${base}/`, { method: "POST" })).status).toBe(405);
    const headers = (await fetch(`${base}/`)).headers;
    expect(headers.get("x-content-type-options")).toBe("nosniff");
    expect(headers.get("x-frame-options")).toBe("DENY");
    rmSync(join(dir, "..", "dist-test-secret.txt"), { force: true });
  });

  it("serves under a base path when configured", async () => {
    writeValidDist(dir, "/civil");
    await start({ basePath: "/civil" });
    expect((await fetch(`${base}/civil/`)).status).toBe(200);
    expect((await fetch(`${base}/civil/_next/static/chunks/app.abc123.js`)).status).toBe(200);
    expect((await fetch(`${base}/`)).status).toBe(404);
  });

  it("resolveFile maps folders and extension-less pages and rejects escapes", () => {
    writeValidDist(dir);
    writeFileSync(join(dir, "page.html"), "<html/>");
    expect(resolveFile(dir, "/")?.endsWith("index.html")).toBe(true);
    expect(resolveFile(dir, "/about")?.endsWith(join("about", "index.html"))).toBe(true);
    expect(resolveFile(dir, "/page")?.endsWith("page.html")).toBe(true);
    expect(resolveFile(dir, "/../etc/passwd")).toBeNull();
    expect(resolveFile(dir, "/%E0%A4%A")).toBeNull();
  });
});
