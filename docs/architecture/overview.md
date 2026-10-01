# Architecture overview

```text
apps/web (Next.js UI)              presentation only — no engineering formulas
   │ calls
packages/engineering-core          pure calculation functions, unit library, code constants
   │ validates with
packages/engineering-validation    Zod schemas + engineering-aware ERROR/WARNING/INFO rules
   │ types from
packages/shared-types              domain model, result model, code references
```

Planned packages: `engineering-reporting` (PDF), `engineering-excel` (XLSX), `ui` (shared components).

## Rules

1. Engineering formulas live only in `packages/engineering-core`. The UI consumes `PunchingShearResult`.
2. Engine functions are pure and deterministic: `calculatePunchingShear(input) → PunchingShearOutcome`.
3. Invalid input or geometry returns `{ ok: false, status: "UNAVAILABLE", reason, action }` — never a DCR.
4. Code constants live in `engineering-core/src/codes/<code-edition>.ts`, each with its provision cited.
   New editions (ACI 318-14, 318-25, EC2, CSA A23.3) are added as sibling modules.
5. Canonical engine units: lb, in, lb-in, psi. All conversion goes through `engineering-core/src/units`.
6. Every result records `meta.engineVersion`, `meta.designCode`, `meta.method`. Bump `ENGINE_VERSION` on any formula change.
7. Internal packages export TypeScript source (`exports: ./src/index.ts`); Next.js transpiles them (`transpilePackages`).

## Result model

`PunchingShearResult` carries `demand`, `geometry`, `capacity`, `dcr`, `status`, `governingCheck`,
`steps[]` (formula, substitution, value, unit, code reference), `codeReferences[]`, `warnings[]`, `meta`.

## Persistence (Milestone 5)

`prisma/schema.prisma` defines `Project`, `StructuralMember`, append-only `Calculation` (input + result snapshots,
revision, engine version, code edition) and `AuditLog`. Historical results are never modified.
