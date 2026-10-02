import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  PROVIDERS,
  loadHeaderConfig,
  writeProviderConfig,
} from "../../scripts/add-provider-config.mjs";

const REPO = join(import.meta.dirname, "..", "..");
let root: string;

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "provider-test-"));
  mkdirSync(join(root, "deploy"), { recursive: true });
  cpSync(
    join(REPO, "deploy", "security-headers.json"),
    join(root, "deploy", "security-headers.json"),
  );
  mkdirSync(join(root, "dist", "_next", "static"), { recursive: true });
  writeFileSync(join(root, "dist", "index.html"), "<html></html>");
  writeFileSync(join(root, "dist", "404.html"), "<html>404</html>");
});
afterEach(() => rmSync(root, { recursive: true, force: true }));

const config = loadHeaderConfig(REPO);
const file = (...p: string[]) => readFileSync(join(root, ...p), "utf8");

describe("provider config generator (no secrets, one header source)", () => {
  it.each(["cloudflare", "netlify"])(
    "%s: writes dist/_headers with every shared header and immutable assets",
    (provider) => {
      expect(writeProviderConfig(provider, { root })).toEqual(["dist/_headers"]);
      const text = file("dist", "_headers");
      for (const [name, value] of Object.entries(config.headers))
        expect(text).toContain(`${name}: ${value}`);
      expect(text).toMatch(
        /\/_next\/static\/\*\n {2}Cache-Control: public, max-age=31536000, immutable/,
      );
    },
  );

  it("azure: staticwebapp.config.json with global headers and a 404 override", () => {
    writeProviderConfig("azure", { root });
    const json = JSON.parse(file("dist", "staticwebapp.config.json"));
    expect(json.globalHeaders).toEqual(config.headers);
    expect(json.responseOverrides["404"]).toEqual({ rewrite: "/404.html", statusCode: 404 });
    expect(json.routes[0].headers["Cache-Control"]).toContain("immutable");
  });

  it("firebase: firebase.json publishes dist with headers, optional site", () => {
    writeProviderConfig("firebase", { root });
    const plain = JSON.parse(file("firebase.json")).hosting;
    expect(plain.public).toBe("dist");
    expect(plain.site).toBeUndefined();
    expect(plain.headers[0].headers).toContainEqual({ key: "X-Frame-Options", value: "DENY" });
    writeProviderConfig("firebase", { root, site: "my-site" });
    expect(JSON.parse(file("firebase.json")).hosting.site).toBe("my-site");
  });

  it("vercel: Build Output API v3 with static files, headers and a 404 route", () => {
    writeProviderConfig("vercel", { root });
    expect(existsSync(join(root, ".vercel", "output", "static", "index.html"))).toBe(true);
    const out = JSON.parse(file(".vercel", "output", "config.json"));
    expect(out.version).toBe(3);
    expect(
      out.routes.some(
        (r: { headers?: Record<string, string> }) => r.headers?.["Content-Security-Policy"],
      ),
    ).toBe(true);
    expect(out.routes.at(-1)).toEqual({ src: "/(.*)", status: 404, dest: "/404.html" });
  });

  it("none: nothing to add, and the provider list is stable", () => {
    expect(writeProviderConfig("none", { root })).toEqual([]);
    expect(PROVIDERS).toEqual(["cloudflare", "netlify", "azure", "vercel", "firebase", "none"]);
  });

  it("rejects unknown providers and a missing dist", () => {
    expect(() => writeProviderConfig("heroku", { root })).toThrow(/Unknown provider/);
    rmSync(join(root, "dist"), { recursive: true });
    expect(() => writeProviderConfig("cloudflare", { root })).toThrow(/Build first/);
  });
});
