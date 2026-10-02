import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Guards for the hosting pipelines: no credentials in the repository, pinned actions, least-privilege
 * permissions, the documented default enablement (GitHub Pages + Cloudflare Pages on, the rest opt-in), and
 * documentation of every secret / variable a workflow reads.
 */
const ROOT = join(import.meta.dirname, "..", "..");
const WORKFLOWS = join(ROOT, ".github", "workflows");
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), "utf8");

const workflowFiles = readdirSync(WORKFLOWS).filter((f) => f.endsWith(".yml"));
const deployFiles = workflowFiles.filter((f) => f.startsWith("deploy-"));
const workflow = (name: string) => readFileSync(join(WORKFLOWS, name), "utf8");

const CONFIG_FILES = [
  ...workflowFiles.map((f) => join(".github", "workflows", f)),
  ".gitlab-ci.yml",
  "render.yaml",
  join("deploy", "security-headers.json"),
];

const CREDENTIAL_PATTERNS: [string, RegExp][] = [
  ["AWS access key", /\b(AKIA|ASIA)[0-9A-Z]{16}\b/],
  ["private key", /-----BEGIN [A-Z ]*PRIVATE KEY-----/],
  ["GitHub token", /\bgh[pousr]_[A-Za-z0-9]{30,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["Google API key", /\bAIza[0-9A-Za-z_-]{35}\b/],
  ["Render deploy hook", /api\.render\.com\/deploy\/srv-[A-Za-z0-9?=&_-]{10,}/],
  [
    "Netlify/Vercel/Cloudflare style token assignment",
    /(token|secret|password)\s*[:=]\s*["']?[A-Za-z0-9_-]{24,}["']?\s*$/im,
  ],
];

describe("no credentials in the repository", () => {
  it.each(CONFIG_FILES)("%s contains no hard-coded credential", (file) => {
    const text = read(file);
    for (const [label, pattern] of CREDENTIAL_PATTERNS) {
      // Expressions like ${{ secrets.X }} are fine; literal long tokens are not.
      expect(text.replace(/\$\{\{[^}]*\}\}/g, ""), `${file}: ${label}`).not.toMatch(pattern);
    }
  });

  it("secrets are only referenced through the secrets context", () => {
    for (const file of deployFiles) {
      const secretUses = [...workflow(file).matchAll(/secrets\.([A-Z0-9_]+)/g)].map((m) => m[1]);
      for (const name of secretUses) expect(name).toMatch(/^[A-Z][A-Z0-9_]+$/);
    }
  });
});

describe("workflow hygiene", () => {
  it.each(workflowFiles)("%s pins every action to a version tag", (file) => {
    for (const m of workflow(file).matchAll(/^\s*-?\s*uses:\s*(\S+)/gm)) {
      const ref = m[1] ?? "";
      if (ref.startsWith("./")) continue;
      expect(ref, `${file}: ${ref}`).toMatch(/@v\d+(\.\d+){0,2}$/);
    }
  });

  it.each(workflowFiles)("%s declares least-privilege permissions", (file) => {
    const text = workflow(file);
    expect(text).toMatch(/^permissions:\s*\n\s+contents: read/m);
    expect(text).not.toMatch(/permissions:\s*write-all/);
  });

  it("only keyless-cloud and Pages pipelines may request an OIDC token", () => {
    const withOidc = workflowFiles.filter((f) => /id-token:\s*write/.test(workflow(f)));
    expect(withOidc.sort()).toEqual(["deploy-firebase.yml", "deploy-s3.yml", "pages.yml"]);
  });

  it.each(deployFiles)(
    "%s can run manually and on a version tag, and reuses the shared build",
    (file) => {
      const text = workflow(file);
      expect(text).toMatch(/workflow_dispatch:/);
      expect(text).toMatch(/tags:\s*\["v\*\.\*\.\*"\]/);
      expect(text).toContain("uses: ./.github/workflows/_build-dist.yml");
    },
  );

  it.each(deployFiles)("%s validates its configuration before deploying", (file) => {
    expect(workflow(file)).toMatch(/Validate configuration/);
  });
});

describe("default enablement", () => {
  const optIn: Record<string, string> = {
    "deploy-s3.yml": "DEPLOY_AWS_S3",
    "deploy-netlify.yml": "DEPLOY_NETLIFY",
    "deploy-vercel.yml": "DEPLOY_VERCEL",
    "deploy-firebase.yml": "DEPLOY_FIREBASE",
    "deploy-azure-static-web-apps.yml": "DEPLOY_AZURE_SWA",
    "deploy-codeberg.yml": "DEPLOY_CODEBERG",
    "deploy-render.yml": "DEPLOY_RENDER",
  };

  it("GitHub Pages is on unless DEPLOY_GITHUB_PAGES=false", () => {
    expect(workflow("pages.yml")).toContain("vars.DEPLOY_GITHUB_PAGES != 'false'");
  });

  it("Cloudflare Pages is on unless DEPLOY_CLOUDFLARE=false (and inert until configured)", () => {
    const text = workflow("deploy-cloudflare.yml");
    expect(text).toContain("vars.DEPLOY_CLOUDFLARE != 'false'");
    expect(text).toContain("vars.CLOUDFLARE_PROJECT_NAME != ''");
  });

  it.each(Object.entries(optIn))("%s is off unless %s=true", (file, variable) => {
    const text = workflow(file);
    expect(text).toContain(`vars.${variable} == 'true'`);
    expect(text).not.toContain(`vars.${variable} != 'false'`);
  });

  it("every provider documented as default-off is listed in the guide", () => {
    const guide = read("docs", "deployment", "README.md");
    for (const variable of Object.values(optIn)) expect(guide).toContain(`\`${variable}=true\``);
    expect(guide).toContain("`DEPLOY_GITHUB_PAGES=false`");
    expect(guide).toContain("`DEPLOY_CLOUDFLARE=false`");
  });
});

describe("documentation covers every secret and variable", () => {
  const guide = read("docs", "deployment", "README.md") + read("docs", "deployment", "aws-s3.md");
  const referenced = (kind: "secrets" | "vars") => {
    const names = new Set<string>();
    for (const file of workflowFiles) {
      for (const m of workflow(file).matchAll(new RegExp(`${kind}\\.([A-Za-z0-9_]+)`, "g"))) {
        if (m[1] !== "GITHUB_TOKEN") names.add(m[1] as string);
      }
    }
    return [...names].sort();
  };

  it.each(referenced("secrets"))("secret %s is documented", (name) => {
    expect(guide).toContain(name);
  });
  it.each(referenced("vars"))("variable %s is documented", (name) => {
    expect(guide).toContain(name);
  });
});

describe("Render and GitLab configuration", () => {
  const headers = JSON.parse(read("deploy", "security-headers.json")) as {
    headers: Record<string, string>;
    immutable: { path: string; cacheControl: string };
  };

  it("render.yaml carries exactly the shared security headers and no secret values", () => {
    const text = read("render.yaml");
    for (const [name, value] of Object.entries(headers.headers)) {
      expect(text).toContain(`name: ${name}`);
      expect(text).toContain(JSON.stringify(value));
    }
    expect(text).toContain(headers.immutable.cacheControl);
    // BASE_PATH is set in the Render dashboard (sync: false), never in the repository.
    expect(text).toMatch(/key: BASE_PATH\s*\n\s*sync: false/);
    expect(text).toContain("autoDeploy: false");
  });

  it("GitLab pipeline only runs on version tags or manual pipelines", () => {
    const text = read(".gitlab-ci.yml");
    expect(text).toMatch(/CI_COMMIT_TAG =~ \/\^v/);
    expect(text).toContain('CI_PIPELINE_SOURCE == "web"');
    expect(text).not.toMatch(/CI_COMMIT_BRANCH/);
  });

  it("shared header source covers the baseline set", () => {
    expect(Object.keys(headers.headers)).toEqual(
      expect.arrayContaining([
        "Content-Security-Policy",
        "Strict-Transport-Security",
        "X-Frame-Options",
        "X-Content-Type-Options",
        "Referrer-Policy",
        "Permissions-Policy",
      ]),
    );
    expect(headers.headers["Content-Security-Policy"]).toContain("frame-ancestors 'none'");
  });
});
