# Civil Engineering Platform

Structural engineering calculation platform with transparent, auditable, code-referenced calculations.
First module: **ACI 318-19 two-way punching shear** (interior column, no shear reinforcement, slab openings).

> **Engineering disclaimer.** Results require review by a qualified engineer. Confirm code applicability and
> project-specific conditions; additional checks may be required. This software does not replace professional
> engineering judgment. Independently review results before issuing construction documents.

## Feature status

| Feature                                                                                   | Status                                                                                              |
| ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| ACI 318-19 punching shear — interior rectangular column, no shear reinforcement, openings | **Experimental** — implemented and regression-tested; awaiting independent engineering verification |
| Unit conversion library (US ↔ SI)                                                         | Experimental                                                                                        |
| Interactive dashboard, SVG visualization                                                  | Planned (Milestones 2–3)                                                                            |
| PDF report, Excel export                                                                  | Planned (Milestone 4)                                                                               |
| Persistence, revisions, audit trail                                                       | Planned (Milestone 5) — schema in `prisma/`                                                         |
| Authentication, sharing                                                                   | Planned (Milestone 6)                                                                               |
| Edge/corner columns, shear reinforcement, other modules                                   | Planned                                                                                             |

No feature is yet classified **Verified engineering calculation**; that requires sign-off recorded in `docs/verification/`.

## Architecture

```text
apps/web                         Next.js UI (presentation only)
packages/engineering-core        pure calculation engine, units, code constants, geometry
packages/engineering-validation  Zod schemas + engineering-aware validation
packages/shared-types            domain and result types
packages/engineering-reporting   (planned) PDF
packages/engineering-excel       formatted Excel export (ExcelJS)
packages/ui                      (planned) shared components
tests/{unit,integration,regression,e2e}
docs/{architecture,engineering-basis,verification,user-guide}
prisma/                          PostgreSQL schema
docker/                          Dockerfile, docker-compose (Postgres)
```

Engineering formulas never live in UI code. See [docs/architecture/overview.md](docs/architecture/overview.md).

## Technology stack

TypeScript (strict) · pnpm workspaces · Turborepo · Next.js 16 · React 19 · Tailwind CSS 4 · Zod 4 · Vitest ·
ESLint · Prettier · PostgreSQL + Prisma (planned) · Docker · GitHub Actions.

## Installation (macOS)

```bash
brew install git node@24
brew install --cask visual-studio-code docker
corepack enable
pnpm install
```

Full instructions: [docs/user-guide/getting-started.md](docs/user-guide/getting-started.md).

## Development

| Task                                     | Command                              |
| ---------------------------------------- | ------------------------------------ |
| Start dev server (http://localhost:3000) | `pnpm dev`                           |
| Run all tests                            | `pnpm test`                          |
| Engineering regression tests only        | `pnpm test:regression`               |
| Lint                                     | `pnpm lint`                          |
| Format                                   | `pnpm format`                        |
| Typecheck                                | `pnpm typecheck`                     |
| Production build                         | `pnpm build`                         |
| Everything CI runs                       | `pnpm verify`                        |
| Start PostgreSQL                         | `cp .env.example .env && pnpm db:up` |
| Stop PostgreSQL                          | `pnpm db:down`                       |
| Generate reports                         | Not yet available (Milestone 4)      |

## Deployment

**Live:** https://www.shragavi.com/civil-engineering-platform

The workspace is fully client-side (the engine runs in the browser), so it ships as a static site on GitHub Pages.
`.github/workflows/pages.yml` runs lint, typecheck and all engineering tests on every push to `main`; only if they
pass does it build a static export (`STATIC_EXPORT=true`, base path from `actions/configure-pages`) and deploy it.
The path works because the user site `ichbinashwin.github.io` owns the custom domain `www.shragavi.com`, so every
project site is served at `www.shragavi.com/<repository>`.

Local preview of the Pages build:

```bash
STATIC_EXPORT=true PAGES_BASE_PATH=/civil-engineering-platform pnpm --filter @civil/web build
# output: apps/web/out
```

**Hosting pipelines.** Each provider has its own opt-in workflow; by default only GitHub Pages and Cloudflare Pages
(inert until `CLOUDFLARE_PROJECT_NAME` is set) are enabled, all others are off. Nothing secret is stored in the
repository (GitHub Secrets/Variables, OIDC where possible). Overview, defaults and setup per provider (Cloudflare,
Netlify, Vercel, Firebase, Azure, Codeberg, Render, GitLab, S3): [docs/deployment/README.md](docs/deployment/README.md).

**AWS S3.** `.github/workflows/deploy-s3.yml` (opt in with `DEPLOY_AWS_S3=true`) builds `dist/` and uploads only that directory to an S3 bucket (keyless
GitHub OIDC → IAM role, immutable caching for hashed assets, optional CloudFront invalidation) on a `v*.*.*` tag or
manually. Verify the exact bundle locally first with `pnpm verify:dist`. Setup (bucket, CloudFront, IAM policies,
repository variables): [docs/deployment/aws-s3.md](docs/deployment/aws-s3.md).

GitHub Pages cannot send HTTP headers; the static build carries its Content-Security-Policy as a `<meta>` tag. The
Docker/server build (`docker/Dockerfile.web`) keeps the full header set.

## Engineering calculation methodology

See [docs/engineering-basis/aci318-19-punching-shear.md](docs/engineering-basis/aci318-19-punching-shear.md).
Every result exposes each step's formula, substituted values, result, unit and ACI 318-19 provision, plus warnings
(ERROR / WARNING / INFO). Invalid input returns _Calculation unavailable_ with a reason — never a DCR.

## Supported codes

| Code                           | Status                                                              |
| ------------------------------ | ------------------------------------------------------------------- |
| ACI 318-19                     | Punching shear (interior column)                                    |
| ACI 318-14 / 318-25, CSA A23.3 | Architecture-ready (`engineering-core/src/codes/`), not implemented |

## Calculation verification

[docs/verification/formula-audit.md](docs/verification/formula-audit.md) audits every formula. The engine reproduces
the independent CSI hand calculation _ACI 318-14 RC-PN-001_ exactly (bo, γv, IXX, IYY, vu = 0.1930 ksi,
φvc = 0.158 ksi, ratio 1.22) and passes brute-force numerical cross-checks of the opening geometry.

[docs/verification/punching-reference-case.md](docs/verification/punching-reference-case.md) compares the engine
with the supplied reference calculation. Key finding: the reference omits the ACI 318-19 size-effect factor λs;
the engine applies λs by default (DCR 0.895) and reproduces the reference (DCR 0.785) only with
`options.applySizeEffectFactor: false`, flagging non-conformance.

## Reporting

**Excel** — header button _Export Excel_ downloads a formatted workbook (`packages/engineering-excel`). Calculation
sheets show the live Excel formula, the engine value and their difference Δ side by side; a unit test evaluates
every formula and confirms it reproduces the engine. The engine remains authoritative.
**PDF** — browser _Print / PDF_ for now; a dedicated PDF report is planned (Milestone 4).

## Security

See [SECURITY.md](SECURITY.md). Highlights: Zod validation on all engine input, security headers in
`apps/web/next.config.ts`, no secrets in source (`.env` git-ignored), Dependabot, CodeQL and `pnpm audit` in CI.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Pull requests fail if any engineering test fails.

## Roadmap

See [docs/architecture/roadmap.md](docs/architecture/roadmap.md).
