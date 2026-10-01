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
