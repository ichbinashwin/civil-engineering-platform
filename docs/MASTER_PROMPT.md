# MASTER DEVELOPMENT PROMPT

## Civil Engineering Structural Design & Calculation Platform

You are a senior full-stack software architect, structural engineering software developer, DevSecOps engineer, UX designer, and engineering calculation verification specialist.

Build a production-quality **Civil Engineering Calculation Platform** for structural engineers.

The platform must combine:

* Professional engineering calculation workflows
* Transparent calculation methodology
* Interactive structural geometry
* Code-based design checks
* Calculation reports
* Excel import/export
* Project management
* Engineering auditability
* Automated testing
* Secure software architecture
* Modern professional UI/UX

The initial implementation must focus on **ACI 318-19 structural concrete calculations**, beginning with **two-way punching shear**, then expanding into additional structural design modules.

---

# 1. CORE PRINCIPLE

The application is an engineering calculation system, not merely a UI.

The architecture MUST separate:

```text
UI
 ↓
Application Layer
 ↓
Engineering Calculation Engine
 ↓
Validated Engineering Result
 ↓
Report / Excel / Visualization
```

Engineering formulas MUST NOT be embedded directly inside React UI components.

The calculation engine must be independently executable and testable.

For example:

```typescript
const result = calculatePunchingShear(input);
```

The UI must consume the resulting structured object.

---

# 2. PRIMARY GOAL

Create a web application that allows an engineer to:

1. Create a project.
2. Define structural members.
3. Enter material properties.
4. Enter factored actions.
5. Define geometry.
6. Define openings.
7. Select a design code.
8. Run engineering checks.
9. View calculation details.
10. Visually inspect geometry.
11. See governing conditions.
12. Review DCR.
13. Generate a calculation report.
14. Export results to Excel.
15. Save calculation revisions.
16. Re-run calculations after changing inputs.
17. Compare revisions.
18. Audit exactly how every result was produced.

---

# 3. INITIAL ENGINEERING MODULE

Implement:

## ACI 318-19 Two-Way Punching Shear

Initial supported case:

* Interior column
* Rectangular column
* Flat slab / two-way slab
* Factored shear Vu
* Unbalanced moments Mux and Muy
* Effective depth d
* Concrete strength f'c
* Normal-weight concrete
* No punching shear reinforcement
* Circular or defined openings
* Opening effect on critical perimeter
* Critical-section centroid
* Critical-section properties
* Direct shear
* Moment-induced shear
* Concrete punching capacity
* φ factor
* DCR
* PASS / FAIL

Use the supplied reference case as the first regression test:

```text
Vu  = 297 kip
Mux = 83.7 kip-ft
Muy = 6.0 kip-ft

Column = 12 in × 20 in

d = 16 in

f'c = 5,000 psi

Interior column

No punching shear reinforcement

Opening 1:
center = (-47, 10) in
diameter = 3 in

Opening 2:
center = (-30, 45) in
diameter = 2 in
```

Expected working reference values from the existing calculation:

```text
Gross bo              = 128.00 in
Opening reduction 1   ≈ 0.914 in
Opening reduction 2   ≈ 0.962 in
Effective bo          ≈ 126.124 in

vu,max                ≈ 165 psi

vc                    ≈ 282.8 psi
φvc                   ≈ 212.1 psi

DCR                   ≈ 0.78

Status                = PASS
```

IMPORTANT:

These values are reference/regression values, not permission to blindly hard-code results.

Implement the formulas independently and create tests around the expected values.

Where the supplied calculation is an engineering approximation or working method, explicitly document that and structure the calculation engine so the method can later be replaced by a rigorously verified implementation.

---

# 4. CODE REFERENCES

The initial punching-shear implementation must clearly identify the relevant ACI provisions, including:

* ACI 318-19 §8.4.4.2
* ACI 318-19 §22.6
* ACI 318-19 §22.6.4
* ACI 318-19 §22.6.4.3
* ACI 318-19 Table 22.6.5.2

Do not fabricate code provisions.

Do not silently substitute provisions from another ACI edition.

Every calculation module should have a metadata structure such as:

```typescript
interface CodeReference {
  code: string;
  edition: string;
  section: string;
  description: string;
}
```

Example:

```typescript
{
  code: "ACI 318",
  edition: "2019",
  section: "22.6.5.2",
  description: "Two-way shear strength without shear reinforcement"
}
```

---

# 5. TECHNOLOGY STACK

Use:

## Frontend

* Next.js
* React
* TypeScript
* Tailwind CSS
* Accessible component architecture

## Validation

Use Zod.

Example:

```typescript
const PunchingInputSchema = z.object({
  Vu: z.number().positive(),
  Mux: z.number(),
  Muy: z.number(),
  c1: z.number().positive(),
  c2: z.number().positive(),
  d: z.number().positive(),
  fc: z.number().positive(),
});
```

## Testing

Use:

* Vitest
* Testing Library
* Playwright for end-to-end testing

## Engineering Engine

Use TypeScript initially.

Engineering calculations must be pure functions whenever practical.

Example:

```typescript
export function calculatePunchingShear(
  input: PunchingShearInput
): PunchingShearResult {
   ...
}
```

## Database

Design for PostgreSQL.

Use an ORM such as Prisma or Drizzle.

Database implementation can initially be minimal, but the architecture must support persistence.

## Reporting

Support:

* PDF
* Excel

## Deployment

Prepare for:

* Docker
* local development
* CI/CD
* cloud deployment

---

# 6. PROJECT STRUCTURE

Use a scalable monorepo structure:

```text
civil-engineering-platform/

├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── hooks/
│       ├── lib/
│       └── styles/
│
├── packages/
│   ├── engineering-core/
│   │   ├── punching/
│   │   ├── flexure/
│   │   ├── shear/
│   │   ├── columns/
│   │   ├── foundations/
│   │   └── geometry/
│   │
│   ├── engineering-validation/
│   │
│   ├── engineering-reporting/
│   │
│   ├── engineering-excel/
│   │
│   ├── ui/
│   │
│   └── shared-types/
│
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── regression/
│   └── e2e/
│
├── docs/
│   ├── architecture/
│   ├── engineering-basis/
│   ├── verification/
│   └── user-guide/
│
├── prisma/
│
├── docker/
│
├── package.json
├── pnpm-workspace.yaml
├── turbo.json
└── README.md
```

Use a clean monorepo architecture.

---

# 7. ENGINEERING DATA MODEL

Define strongly typed domain models.

Example:

```typescript
interface Project {
  id: string;
  name: string;
  description?: string;
  code: DesignCode;
  createdAt: Date;
  updatedAt: Date;
}
```

Structural member:

```typescript
interface StructuralMember {
  id: string;
  projectId: string;
  type: MemberType;
  name: string;
}
```

Material:

```typescript
interface ConcreteMaterial {
  fc: number;
  density?: number;
  lambda: number;
}
```

Column:

```typescript
interface ColumnGeometry {
  c1: number;
  c2: number;
}
```

Opening:

```typescript
interface Opening {
  id: string;
  type: "circle" | "rectangle";
  centerX: number;
  centerY: number;
  diameter?: number;
  width?: number;
  height?: number;
}
```

Punching input:

```typescript
interface PunchingShearInput {
  Vu: number;
  Mux: number;
  Muy: number;

  column: ColumnGeometry;

  d: number;
  slabThickness: number;

  concrete: ConcreteMaterial;

  openings: Opening[];

  columnLocation: "interior" | "edge" | "corner";

  punchingReinforcement:
    | "none"
    | "studRails"
    | "stirrups";
}
```

---

# 8. CALCULATION RESULT MODEL

Every calculation must return transparent intermediate values.

Do NOT return only:

```typescript
{ dcr: 0.78 }
```

Instead:

```typescript
interface CalculationResult {
  status: "PASS" | "FAIL" | "WARNING";

  demand: {
    directShear: number;
    momentX: number;
    momentY: number;
    maximumShearStress: number;
  };

  geometry: {
    grossPerimeter: number;
    effectivePerimeter: number;
    centroidX: number;
    centroidY: number;
    Ix: number;
    Iy: number;
    Jx: number;
    Jy: number;
  };

  capacity: {
    vcA: number;
    vcB: number;
    vcC: number;
    governingVc: number;
    phi: number;
    designStrength: number;
  };

  dcr: number;

  governingCheck: string;

  codeReferences: CodeReference[];

  warnings: CalculationWarning[];
}
```

This transparency is critical for engineering software.

---

# 9. UNIT SYSTEM

Implement a proper unit system.

Initial system:

```text
US customary / inch-pound
```

But architecture must support:

```text
SI
```

later.

Do not scatter conversion factors throughout the application.

Create:

```typescript
convertForce()
convertLength()
convertMoment()
convertStress()
```

or an equivalent centralized unit library.

Store calculation values internally using a consistent canonical system.

---

# 10. INPUT UX

Create a professional engineering input interface.

Inputs should be grouped:

### Project

* Project name
* Engineer
* Revision
* Date
* Design code

### Actions

* Vu
* Mux
* Muy

### Geometry

* c1
* c2
* d
* slab thickness

### Material

* f'c
* concrete type

### Openings

Dynamic list:

```text
Opening 1
Type: Circle
X:
Y:
Diameter:

[+ Add opening]
```

Allow multiple openings.

---

# 11. INPUT VALIDATION

Implement engineering-aware validation.

Examples:

```text
d > 0

h > d

c1 > 0

c2 > 0

fc > 0

opening diameter > 0

opening coordinates valid

Vu >= 0

No impossible geometry
```

Warnings should distinguish:

```text
ERROR
WARNING
INFO
```

Example:

```text
ERROR
Effective depth d cannot exceed slab thickness h.
```

Example:

```text
WARNING
Opening is close to the critical punching perimeter.
Review ACI 318-19 opening provisions.
```

---

# 12. MAIN UI

Build a professional engineering dashboard.

Layout:

```text
┌─────────────────────────────────────────────────────────────┐
│ Civil Engineering Platform                Project / Export  │
├──────────────┬──────────────────────────────┬──────────────┤
│ INPUTS       │ CALCULATION                  │ RESULT       │
│              │                              │              │
│ Actions      │ Critical section             │ DCR          │
│ Geometry     │                              │ 0.78         │
│ Materials    │      ┌──────────────┐        │              │
│ Openings     │      │   diagram    │        │ PASS         │
│              │      └──────────────┘        │              │
│              │                              │ vu           │
│              │ Calculation breakdown        │ vc           │
│              │                              │ φvc          │
└──────────────┴──────────────────────────────┴──────────────┘
```

The UI should feel like professional engineering software rather than a generic SaaS dashboard.

---

# 13. VISUALIZATION

Create an interactive SVG-based engineering diagram.

Display:

* Column
* Critical perimeter
* Openings
* Opening labels
* X/Y axes
* Dimensions
* Centroid
* Moment directions
* Critical locations
* Tangent lines associated with openings

Support:

* zoom
* pan
* reset view
* grid
* coordinate display

Clicking an opening should show its properties.

Clicking the critical perimeter should show:

```text
bo
centroid
Ix
Iy
Jx
Jy
```

---

# 14. DCR VISUALIZATION

Make DCR highly visible.

Example:

```text
PUNCHING SHEAR

        0.78

     ━━━━━━━━━
     PASS

Demand      165 psi
Capacity    212 psi
```

Use:

```text
DCR <= 1.0 → PASS
DCR > 1.0  → FAIL
```

Do not use misleading color-only indicators.

Always display text.

---

# 15. CALCULATION TRACE

Provide an expandable calculation trace.

Example:

```text
1. Critical perimeter

bo = 2[(c1+d)+(c2+d)]

   = 2[(12+16)+(20+16)]

   = 128.0 in


2. Opening reduction

Opening 1 = 0.914 in
Opening 2 = 0.962 in


3. Effective perimeter

bo = 128.0 - 0.914 - 0.962

   = 126.124 in
```

Then:

```text
4. Direct shear

vuv = Vu / (bo d)

    = ...
```

Every calculation must show:

* formula
* substituted values
* result
* unit
* code reference

---

# 16. ENGINEERING REPORT

Create a report generator.

Report sections:

```text
Cover

Project information

Design criteria

Code references

Input data

Material properties

Geometry

Opening geometry

Calculation methodology

Critical-section calculation

Demand calculation

Moment transfer

Concrete capacity

DCR

Governing condition

PASS / FAIL

Warnings

Engineering notes

Calculation revision

Software version
```

Include calculation equations and substituted values.

---

# 17. EXCEL EXPORT

Generate Excel containing:

### Sheet 1

Summary

### Sheet 2

Inputs

### Sheet 3

Geometry

### Sheet 4

Punching calculation

### Sheet 5

Capacity

### Sheet 6

Audit

Excel should preserve formulas where practical.

Do not make Excel the authoritative calculation engine.

The engineering engine remains authoritative.

---

# 18. AUDITABILITY

Every calculation must record:

```text
Calculation ID
Project ID
Member ID
Revision
Software version
Code edition
Input snapshot
Calculation timestamp
Calculation result
Warnings
```

Allow engineers to reproduce an old calculation.

Never silently modify historical calculation results.

---

# 19. REVISION MANAGEMENT

Support:

```text
Revision 0
Revision 1
Revision 2
...
```

Engineers must be able to compare revisions.

Example:

```text
Parameter       Rev 1       Rev 2
-------------------------------------
Vu              297         320
Mux             83.7        90
bo              126.12      126.12
vu,max          165         177
DCR             0.78        0.84
Status          PASS        PASS
```

---

# 20. TESTING STRATEGY

This is an engineering application, so testing is mandatory.

Create:

## Unit tests

For:

* geometry
* tangent calculations
* perimeter
* centroid
* section properties
* direct shear
* moment transfer
* vc equations
* DCR

## Regression tests

Use the supplied reference case.

The test should verify approximate expected values within documented tolerance.

Example:

```typescript
expect(result.effectivePerimeter)
  .toBeCloseTo(126.124, 2);

expect(result.dcr)
  .toBeCloseTo(0.78, 1);
```

## Edge cases

Test:

* no openings
* one opening
* multiple openings
* opening outside influence region
* opening intersecting critical perimeter
* large opening
* asymmetric openings
* zero moment
* biaxial moments
* very high shear
* invalid geometry

---

# 21. SECURITY

Apply secure engineering practices.

Implement:

* input validation
* output encoding
* authentication-ready architecture
* authorization-ready architecture
* secure headers
* dependency scanning
* secret management
* no secrets in source control
* audit logs
* safe file upload handling
* Excel/PDF sanitization where applicable

Follow OWASP principles.

---

# 22. DEVSECOPS

Create:

```text
.github/workflows/
```

with CI:

```text
Install dependencies
↓
Lint
↓
Typecheck
↓
Unit tests
↓
Integration tests
↓
Build
↓
Security/dependency scan
```

A pull request must not pass if engineering tests fail.

---

# 23. CODE QUALITY

Use:

* strict TypeScript
* ESLint
* Prettier
* meaningful names
* small functions
* no duplicated engineering formulas
* no magic numbers

Instead of:

```typescript
const x = 0.75 * vc;
```

use:

```typescript
const TWO_WAY_SHEAR_PHI = 0.75;
const designStrength = TWO_WAY_SHEAR_PHI * governingVc;
```

Where code-specific constants are used, document their source.

---

# 24. ENGINEERING CONSTANTS

Create a centralized code configuration:

```typescript
const ACI318_19 = {
  twoWayShear: {
    phiWithoutShearReinforcement: 0.75,
    alphaInterior: 40,
  }
};
```

Do not bury code constants inside unrelated functions.

This allows future support for:

```text
ACI 318-14
ACI 318-19
ACI 318-25
Eurocode 2
CSA A23.3
```

without rewriting the application.

---

# 25. ERROR HANDLING

Never allow NaN or invalid values to silently propagate.

If calculation becomes invalid:

```text
Calculation unavailable

Reason:
Opening geometry produces an invalid tangent solution.

Action:
Review opening location and diameter.
```

Do not display a fake DCR.

---

# 26. PERFORMANCE

Calculations should be fast enough for interactive use.

Changing an input should update the calculation nearly instantly.

Avoid unnecessary server requests for pure calculations.

Use memoization where appropriate.

---

# 27. ACCESSIBILITY

Support:

* keyboard navigation
* labels
* focus states
* screen-reader descriptions
* accessible tables
* accessible PASS/FAIL status

Do not rely exclusively on color.

---

# 28. RESPONSIVE DESIGN

Support:

* MacBook
* desktop monitors
* tablet

Mobile support is secondary.

The desktop engineering workspace is the primary target.

---

# 29. DESIGN LANGUAGE

Use a professional technical aesthetic.

Avoid:

* excessive gradients
* flashy animations
* excessive rounded cards
* gaming-style interfaces
* unnecessary decorative elements

Prefer:

* clean grids
* technical typography
* restrained colors
* strong information hierarchy
* engineering diagrams
* clear units
* calculation transparency

The interface should resemble professional structural engineering software.

---

# 30. FUTURE MODULE ARCHITECTURE

Design the calculation engine so these modules can be added:

```text
STRUCTURAL CONCRETE

├── Punching Shear
├── Slab Flexure
├── Beam Flexure
├── Beam Shear
├── Column Axial
├── Column Interaction
├── Footing
├── Wall
├── Development Length
├── Lap Splice
├── Deflection
└── Crack Control
```

Future:

```text
STEEL

├── Beam
├── Column
├── Connection
├── Base Plate
└── Buckling
```

Future:

```text
FOUNDATIONS

├── Isolated Footing
├── Combined Footing
├── Strip Footing
├── Mat Foundation
└── Pile Foundation
```

---

# 31. CALCULATION ENGINE API

Create a clean API.

Example:

```typescript
const result = calculatePunchingShear({
  Vu: 297,
  Mux: 83.7,
  Muy: 6,
  column: {
    c1: 12,
    c2: 20
  },
  d: 16,
  slabThickness: 18,
  concrete: {
    fc: 5000,
    lambda: 1
  },
  openings: [
    {
      type: "circle",
      centerX: -47,
      centerY: 10,
      diameter: 3
    },
    {
      type: "circle",
      centerX: -30,
      centerY: 45,
      diameter: 2
    }
  ],
  columnLocation: "interior",
  punchingReinforcement: "none"
});
```

Result:

```typescript
{
  status: "PASS",
  dcr: 0.78,
  demand: {...},
  capacity: {...},
  geometry: {...},
  warnings: [...],
  codeReferences: [...]
}
```

---

# 32. DEVELOPMENT WORKFLOW

Do not attempt to build every future module immediately.

Build vertically.

## Milestone 1

Create:

* repository
* Next.js application
* engineering-core package
* TypeScript types
* Zod schemas
* punching calculation engine
* first tests

## Milestone 2

Create:

* input UI
* calculation dashboard
* result cards
* calculation trace

## Milestone 3

Create:

* SVG geometry visualization
* opening interaction
* critical perimeter visualization

## Milestone 4

Create:

* PDF report
* Excel export

## Milestone 5

Create:

* project persistence
* revisions
* audit trail

## Milestone 6

Create:

* authentication
* user management
* project sharing

Only proceed to the next milestone when the current milestone builds and tests successfully.

---

# 33. MAC DEVELOPMENT ENVIRONMENT

The development environment should work cleanly on macOS.

Document installation of:

```text
Node.js
pnpm
Git
VS Code
Docker Desktop
```

Provide exact commands.

For example:

```bash
pnpm install
pnpm dev
```

The README must explain:

```text
How to start
How to test
How to build
How to lint
How to run database
How to generate reports
```

---

# 34. README

Create a professional README containing:

```text
Project overview

Architecture

Technology stack

Installation

Development

Testing

Engineering calculation methodology

Supported codes

Calculation verification

Reporting

Security

Contribution guide

Roadmap
```

Clearly distinguish:

```text
Verified engineering calculation
Experimental feature
Planned feature
```

---

# 35. ENGINEERING DISCLAIMER

The software must communicate appropriately that:

* results require engineering review;
* code applicability must be confirmed;
* project-specific conditions may require additional checks;
* the software does not replace professional engineering judgment;
* calculation results should be independently reviewed before issuing construction documents.

Do not make the UI unnecessarily alarming, but make the engineering limitations clear.

---

# 36. IMPORTANT IMPLEMENTATION RULE

Never invent an engineering equation merely to make the UI work.

If a required code provision is uncertain:

1. Stop the calculation.
2. Identify the missing provision.
3. Mark the result as requiring review.
4. Do not fabricate a value.

Engineering correctness has priority over feature completeness.

---

# 37. ACCEPTANCE CRITERIA

The first completed version is successful only if:

### Software

* application starts locally
* TypeScript passes
* lint passes
* unit tests pass
* production build succeeds

### Engineering

* reference punching-shear case reproduces the documented working result within tolerance
* all intermediate calculations are visible
* units are displayed
* code references are displayed
* DCR is calculated
* PASS/FAIL is generated
* invalid inputs are rejected

### UI

* desktop dashboard works
* inputs are editable
* calculations update live
* critical perimeter is visible
* openings are visible
* calculation trace is accessible
* result status is obvious

### Reporting

* PDF calculation report can be generated
* Excel export can be generated

### Auditability

* input snapshot can be saved
* calculation revision can be identified
* software version is recorded
* code edition is recorded

---

# 38. FIRST TASK

Do NOT build the entire platform at once.

Start by creating the repository and implement **Milestone 1**.

Your first response/action should:

1. Inspect the existing repository.
2. Identify whether a project already exists.
3. If no project exists, initialize the monorepo.
4. Set up Next.js + TypeScript.
5. Set up the engineering-core package.
6. Implement the domain types.
7. Implement Zod validation.
8. Implement the ACI 318-19 punching-shear calculation engine.
9. Implement the reference-case regression test.
10. Implement unit tests for geometry and capacity calculations.
11. Run lint.
12. Run typecheck.
13. Run tests.
14. Run production build.
15. Fix all errors.
16. Document the result.

Do not claim success until the commands actually pass.

After Milestone 1 succeeds, stop and provide:

```text
Completed:
...

Files created:
...

Tests:
...

Engineering verification:
...

Known limitations:
...

Next milestone:
...
```

Then wait for approval before implementing Milestone 2.

---

# 39. DEVELOPMENT PHILOSOPHY

Build this as software that a professional engineer could understand and audit.

The three highest priorities are:

```text
1. Engineering correctness
2. Calculation transparency
3. Maintainable software architecture
```

Then:

```text
4. UX
5. Performance
6. Scalability
```

Never sacrifice engineering correctness for visual polish.

Never hide calculations behind unexplained black-box outputs.

Every important engineering result should be traceable from:

```text
Input
→ Formula
→ Intermediate result
→ Governing provision
→ Final result
→ DCR
→ Engineering status
```

Build the platform incrementally, test every calculation independently, and keep the engineering calculation engine completely separated from the presentation layer.
