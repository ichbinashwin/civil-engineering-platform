# Hosting pipelines

Each hosting provider has its **own independent pipeline**. You choose which ones run. Every pipeline builds the same
production bundle (`dist/`, see [AWS S3 guide](aws-s3.md) for `pnpm build:dist` / `pnpm verify:dist`) after the same
gate (lint, typecheck, all engineering tests), and deploys only `dist/`.

## What is on by default

| Pipeline                            | File                                      | Default                                                                           | Free address                                       | How to switch                             |
| ----------------------------------- | ----------------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------- | ----------------------------------------- |
| **GitHub Pages**                    | `.github/workflows/pages.yml`             | **ON** (every push to `main`)                                                     | `<owner>.github.io/<repo>` (or your custom domain) | off: variable `DEPLOY_GITHUB_PAGES=false` |
| **Cloudflare Pages**                | `.github/workflows/deploy-cloudflare.yml` | **ON**, inert until `CLOUDFLARE_PROJECT_NAME` is set (every version tag `v*.*.*`) | `<name>.pages.dev`                                 | off: `DEPLOY_CLOUDFLARE=false`            |
| AWS S3 (+ CloudFront)               | `deploy-s3.yml`                           | off                                                                               | your bucket / CloudFront                           | on: `DEPLOY_AWS_S3=true`                  |
| Netlify                             | `deploy-netlify.yml`                      | off                                                                               | `<name>.netlify.app`                               | on: `DEPLOY_NETLIFY=true`                 |
| Vercel (Hobby: non-commercial only) | `deploy-vercel.yml`                       | off                                                                               | `<name>.vercel.app`                                | on: `DEPLOY_VERCEL=true`                  |
| Firebase Hosting                    | `deploy-firebase.yml`                     | off                                                                               | `<project>.web.app`                                | on: `DEPLOY_FIREBASE=true`                |
| Azure Static Web Apps               | `deploy-azure-static-web-apps.yml`        | off                                                                               | `<name>.azurestaticapps.net`                       | on: `DEPLOY_AZURE_SWA=true`               |
| Codeberg Pages                      | `deploy-codeberg.yml`                     | off                                                                               | `<user>.codeberg.page`                             | on: `DEPLOY_CODEBERG=true`                |
| Render                              | `deploy-render.yml` + `render.yaml`       | off                                                                               | `<name>.onrender.com`                              | on: `DEPLOY_RENDER=true`                  |
| GitLab Pages                        | `.gitlab-ci.yml` (runs on GitLab)         | off                                                                               | `<user>.gitlab.io/<repo>`                          | create the GitLab mirror/project          |

"Off" pipelines do nothing on a tag push (the build job is skipped). **A manual run always works** for every
provider: Actions → pick the workflow → _Run workflow_. Variables are set under _Settings → Secrets and variables →
Actions → Variables_, or with the CLI: `gh variable set DEPLOY_NETLIFY --body true`.

## No secrets in the codebase

- Nothing in the repository contains a token, key, password or deploy URL. Workflows read **GitHub Secrets**
  (`${{ secrets.NAME }}`) and **Variables** (`${{ vars.NAME }}`); GitLab and Render read their own dashboard variables.
- Prefer keyless: **AWS** (GitHub OIDC → IAM role) and **Firebase** (Google Workload Identity Federation) store no
  secret at all. The others need one API token each; create it with the minimum scope and store it as an
  **environment secret** (Settings → Environments → the provider's environment) so only that pipeline can read it,
  optionally behind a required reviewer.
- Set secrets without leaving them in shell history: `gh secret set CLOUDFLARE_API_TOKEN` (it prompts), or paste into
  the GitHub UI. Rotate tokens regularly; revoke any that were ever shown in a log.
- Every pipeline validates its configuration first and fails with a clear message listing the missing items, and never
  prints a secret. A test (`tests/unit/deployment-config.test.ts`) fails the build if a workflow hard-codes a
  credential, uses an unpinned action, or references a secret/variable that is not documented here.
- Every provider also gets the same security headers from one file, `deploy/security-headers.json`, rendered into the
  host's native format by `scripts/add-provider-config.mjs` (HSTS, CSP with `frame-ancestors 'none'`, no-sniff, no
  framing, referrer and permissions policies; hashed assets cached immutably, HTML revalidated).

> **Status of the provider pipelines.** GitHub Pages and the S3 workflow's build/check stages were exercised; the
> provider upload steps (Cloudflare, Netlify, Vercel, Firebase, Azure, Codeberg, Render, GitLab) follow each provider's
> documented CLI/action but could not be run without your accounts. Run each once manually (Actions → Run workflow) and
> check the result before relying on a tag push.

## Common settings

Every provider has an optional `<PROVIDER>_BASE_PATH` variable (default empty = site at the domain root). Set it only if
the site is served under a URL prefix, e.g. `/civil-engineering-platform` for GitLab or Codeberg project pages.

## GitHub Pages

On by default; already configured for this repository (`Settings → Pages → Source: GitHub Actions`). Base path comes
from GitHub automatically. Variables: `DEPLOY_GITHUB_PAGES` (set to `false` to stop deploying). Secrets: none.
Note: Pages cannot send custom headers (the page carries a `<meta>` CSP instead).

## Cloudflare Pages

1. Cloudflare dashboard → _Workers & Pages_ → _Create_ → _Pages_ → _Upload assets_ → name it (e.g. `civil-engineering-platform`);
   the first upload can be an empty folder. This gives `https://<name>.pages.dev`.
2. _My Profile → API Tokens → Create Token_ → custom → **Account · Cloudflare Pages · Edit** for your account only.
3. GitHub: secret `CLOUDFLARE_API_TOKEN`; variables `CLOUDFLARE_ACCOUNT_ID` (dashboard URL / right sidebar),
   `CLOUDFLARE_PROJECT_NAME` (setting this activates tag deploys). Optional: `CLOUDFLARE_BRANCH` (the project's
   production branch, default `main`), `CLOUDFLARE_BASE_PATH`, `DEPLOY_CLOUDFLARE=false` to disable.
4. Tag a release (`git tag v0.6.0 && git push origin v0.6.0`) or run the workflow manually.

Security headers are shipped as `dist/_headers`. If you enable Cloudflare Web Analytics, add its script origin to the
CSP in `deploy/security-headers.json`.

## Netlify

1. Netlify → _Add new site → Deploy manually_ (or `netlify sites:create`) → note the **Site ID** (Site configuration).
2. _User settings → Applications → Personal access tokens_ → create a token.
3. GitHub: secret `NETLIFY_AUTH_TOKEN`; variable `NETLIFY_SITE_ID`; `DEPLOY_NETLIFY=true`. Optional:
   `NETLIFY_BASE_PATH`, `NETLIFY_CLI_VERSION` (exact version; pinned in the workflow by default).

## Vercel

Hobby plan is for **non-commercial** use only. Create the project (framework _Other_), then locally run
`npx vercel link` once to read `.vercel/project.json` (`orgId`, `projectId`). Create an access token
(Account → Tokens). GitHub: secret `VERCEL_TOKEN`; variables `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`, `DEPLOY_VERCEL=true`.
Optional `VERCEL_BASE_PATH`, `VERCEL_CLI_VERSION`. The pipeline uploads pre-built static output (no build on Vercel).

## Firebase Hosting

Keyless. In Google Cloud (the Firebase project): create a **Workload Identity Pool + GitHub provider** restricted to
this repository (`attribute.repository == "OWNER/REPO"`), a **service account** with role _Firebase Hosting Admin_, and
let the pool's principal impersonate it (_Workload Identity User_). GitHub variables:
`GCP_WORKLOAD_IDENTITY_PROVIDER` (`projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>`),
`GCP_SERVICE_ACCOUNT`, `FIREBASE_PROJECT_ID`, `DEPLOY_FIREBASE=true`. Optional: `FIREBASE_SITE` (extra site id),
`FIREBASE_BASE_PATH`, `FIREBASE_TOOLS_VERSION`. No secrets.

## Azure Static Web Apps

Azure portal → _Static Web Apps → Create_ → plan **Free**, source **Other** (deployment from CI) → _Manage deployment
token_. GitHub: secret `AZURE_STATIC_WEB_APPS_API_TOKEN`; variable `DEPLOY_AZURE_SWA=true`; optional
`AZURE_SWA_BASE_PATH`. Pick an EU region when creating the resource if data residency matters. Headers ship as
`staticwebapp.config.json`.

## Codeberg Pages

Create a Codeberg repository (e.g. `pages`, which serves at `https://<user>.codeberg.page/`; any other repo name
serves at `https://<user>.codeberg.page/<repo>/`, so set `CODEBERG_BASE_PATH=/<repo>`). Create an access token with
_write:repository_. GitHub: secret `CODEBERG_TOKEN`; variables `CODEBERG_USER`, `CODEBERG_REPO`, `DEPLOY_CODEBERG=true`;
optional `CODEBERG_BRANCH` (default `pages`; force-pushed as a single commit, use a dedicated branch),
`CODEBERG_BASE_PATH`. Codeberg Pages cannot send custom headers.

## Render

`render.yaml` is a blueprint for a free static site that Render builds itself (`pnpm build:dist`, publish `dist/`).
Render dashboard → _New → Blueprint_ → select this repository (auto-deploy is off). In the service's environment set
`BASE_PATH` only if you serve under a prefix. For deploys from GitHub: Render service → _Settings → Deploy Hook_ →
copy the URL into GitHub secret `RENDER_DEPLOY_HOOK_URL` (it embeds a key: treat it as a secret); set
`DEPLOY_RENDER=true`. The workflow gates on tests and the dist build, then triggers Render (which builds the current
head of the linked branch). Variable `RENDER_BASE_PATH` must equal Render's `BASE_PATH`.

## GitLab Pages

`.gitlab-ci.yml` runs only on GitLab. Create a GitLab project and mirror/push this repository to it (GitLab →
_Settings → Repository → Mirroring repositories_, or `git remote add gitlab …`). A version tag or a manual pipeline
(_Build → Pipelines → Run pipeline_) builds and publishes `public/`. CI/CD variables (GitLab → _Settings → CI/CD_,
none secret): `BASE_PATH` (e.g. `/<project>` for `https://<user>.gitlab.io/<project>/`), `RUN_TESTS`.

## AWS S3 (+ CloudFront)

See [aws-s3.md](aws-s3.md). Keyless (GitHub OIDC). Enable with `DEPLOY_AWS_S3=true`.
