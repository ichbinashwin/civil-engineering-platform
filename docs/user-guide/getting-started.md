# Getting started (macOS)

## Install tools

```bash
# Homebrew (if missing)
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install git node@24
brew install --cask visual-studio-code docker   # Docker Desktop
corepack enable                                  # provides pnpm pinned by package.json
```

Verify: `node -v` (≥ 22.12), `pnpm -v`, `git --version`, `docker -v`.

## Run

```bash
pnpm install
pnpm dev            # http://localhost:3000
```

The Milestone 1 page renders the reference punching-shear case and its calculation trace.

## Using the engine directly

```ts
import { calculatePunchingShear, convertForce, convertMoment } from "@civil/engineering-core";

const outcome = calculatePunchingShear({
  Vu: convertForce(297, "kip", "lb"),
  Mux: convertMoment(83.7, "kip-ft", "lb-in"),
  Muy: convertMoment(6, "kip-ft", "lb-in"),
  column: { c1: 12, c2: 20 },
  d: 16,
  slabThickness: 18,
  concrete: { fc: 5000, lambda: 1 },
  openings: [{ type: "circle", centerX: -47, centerY: 10, diameter: 3 }],
  columnLocation: "interior",
  punchingReinforcement: "none",
});

if (outcome.ok) console.log(outcome.dcr, outcome.status, outcome.steps);
else console.log(outcome.reason, outcome.action);
```

## Workspace

- **Inputs (left):** every yellow field is editable; KPIs, tables, trace, plan and 3D update instantly.
  Errors appear under the field and in _Engineering messages_. Invalid input shows _Calculation unavailable_ — never a DCR.
- **Plan 2D:** scroll to zoom, drag to pan, _Fit / reset_. Click an opening or the critical perimeter to inspect
  (bo, centroid, Ix, Iy, Jx, Jy). Perimeter color = vu / φvc; red = ineffective bo (§22.6.4.3).
- **3D:** drag to orbit, right-drag to pan, scroll to zoom. _Spin_ toggles auto-rotation (speed slider);
  presets Iso / Top / Front / Side; _X-ray slab_; _Stress fence_ (height ∝ vu, red dashed loop = φvc).
- **Engineer review:** enter reviewer, _Mark as reviewed_. Any later input change marks the review _outdated_.
- **State** is kept in browser local storage; _Reset example_ restores the reference case.
- **Export JSON** saves input, full result and review for audit. _Print / PDF_ uses the browser print dialog.
- **Export Excel** downloads a formatted workbook: _Summary_ (DCR, status, key results, messages, review),
  _Inputs_, _Geometry_, _Punching calculation_ (demand + full trace), _Capacity_ (Table 22.6.5.2) and _Audit_
  (engine version, code references, warnings, input snapshot). Yellow cells are live formulas; _Engine value_
  and _Δ_ columns let a checker confirm Excel and the engine agree. Disabled while the calculation is unavailable.
- **Theme** (header dropdown): _Structural Blue_ (default), _Blueprint_ (drafting-blueprint drawing canvas),
  _Concrete & Rebar_ (warm greys, rebar-orange accents). **Light / Dark / Auto** toggle next to it; _Auto_
  follows the **time of day in your browser's detected timezone** (light 07:00–19:00, dark 19:00–07:00; hours are
  `AUTO_LIGHT_FROM_HOUR` / `AUTO_DARK_FROM_HOUR` in `apps/web/lib/theme.ts`). It switches at those times without a
  reload and re-checks after sleep or a timezone change; hover _Auto_ to see the timezone and current mode.
  Both choices are remembered in the browser. Colors live in
  `apps/web/lib/theme.ts` (single source for CSS, plan view and 3D). PASS/FAIL is always shown as text.
- **Collapsible panels:** every container (Design Inputs, Key results, Visualization, Calculation tables,
  Calculation trace, Result, Engineer review, Engineering messages, Code references) has a chevron to collapse
  it in place (header stays). The trace starts collapsed. _Expand all / Collapse all_ are above the grid.
- **Sidebar dock:** the button at the right of each header moves a panel into the icon rail on its own side:
  left-column panels (Design Inputs) dock to the **left** rail, right-column panels (Result, Review, Messages,
  References) and the wide centre panels dock to the **right** rail. Only its icon stays visible and the remaining
  panels widen. Click an icon to open the panel as a flyout —
  inputs stay editable and results stay live — then _Restore_ returns it to the dashboard, or press Esc /
  click outside to close. _Restore sidebar panels_ returns everything. Layout is remembered in the browser.
- **Defaults and wallpaper:** a first visit opens in the _Blueprint_ theme in _Dark_ mode (an existing browser keeps
  its saved choice). The page background is a chat-style doodle wallpaper of civil and structural engineering line
  icons (I-beam, truss, bridge, crane, hard hat, rebar section, rulers …) and greyed emojis (👷 🏗️ 🧱 📐 🌉 …),
  recoloured per theme and mode. The header _Wallpaper_ button turns it off and on; printing never includes it.
  Generator: `apps/web/lib/wallpaper.ts`.
