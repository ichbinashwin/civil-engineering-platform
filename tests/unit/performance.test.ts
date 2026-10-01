import { describe, expect, it } from "vitest";
import { calculatePunchingShear, calculatePunchingShearEC2 } from "@civil/engineering-core";
import type { PunchingShearInputEC2 } from "@civil/shared-types";
import { REFERENCE_CASE } from "../fixtures/punching-reference";

/**
 * Interactive use: a calculation must stay well under one frame. Budgets are generous (CI machines vary)
 * but would catch an accidental slowdown of either engine.
 */
const RUNS = 100;
/**
 * Typical cost: ACI ≈ 0.06 ms, EN 1992-1-1 ≈ 0.4 ms per calculation (ratio ≈ 6). Wall-clock budgets on a
 * shared or busy machine are noisy, so only a very loose absolute guard (~100x typical) is asserted; the
 * measured averages are the best of several batches.
 */
const ACI_GUARD_MS = 25;
const EC2_GUARD_MS = 50;

const EC2_INPUT: PunchingShearInputEC2 = {
  VEd: 600e3,
  MEdx: 20e6,
  MEdy: 0,
  column: { c1: 400, c2: 400 },
  d: 200,
  slabThickness: 250,
  fck: 30,
  rhoLx: 0.01,
  rhoLy: 0.01,
  openings: [
    { type: "circle", centerX: -700, centerY: 150, diameter: 150 },
    { type: "rectangle", centerX: 100, centerY: 650, width: 200, height: 120 },
  ],
  columnLocation: "interior",
  punchingReinforcement: "none",
};

/** Best average over several batches: robust against load spikes on shared machines. */
const BATCHES = 5;
function averageMs(run: () => unknown): number {
  run(); // warm up
  let best = Number.POSITIVE_INFINITY;
  for (let batch = 0; batch < BATCHES; batch++) {
    const start = performance.now();
    for (let i = 0; i < RUNS; i++) run();
    best = Math.min(best, (performance.now() - start) / RUNS);
  }
  return best;
}

describe("calculation speed", () => {
  const aci = averageMs(() => calculatePunchingShear(REFERENCE_CASE));
  const ec2 = averageMs(() => calculatePunchingShearEC2(EC2_INPUT));

  it(`ACI 318-19 (two openings) stays under ${ACI_GUARD_MS} ms`, () => {
    expect(aci).toBeLessThan(ACI_GUARD_MS);
  });

  it(`EN 1992-1-1 (two openings, arcs) stays under ${EC2_GUARD_MS} ms`, () => {
    expect(ec2).toBeLessThan(EC2_GUARD_MS);
  });
});
