# Security

## Reporting

Report vulnerabilities privately to the maintainers. Do not open public issues for security problems.

## Practices

- All calculation input is validated with Zod and engineering rules before use.
- React escapes output by default; never use `dangerouslySetInnerHTML` with user data.
- Security headers (CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) in `apps/web/next.config.ts`.
- Secrets only via environment variables; `.env*` is git-ignored (`.env.example` holds placeholders).
- CI: `pnpm audit`, CodeQL, Dependabot.
- Calculation records are append-only (audit trail, Milestone 5).
- Planned: authentication/authorization (Milestone 6), upload size/type limits and formula-injection
  sanitization for Excel import/export (Milestone 4).
