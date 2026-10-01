import { describe, expect, it } from "vitest";
import { calculatePunchingShear, calculatePunchingShearEC2 } from "@civil/engineering-core";
import type { PunchingShearInputEC2 } from "@civil/shared-types";
import { REFERENCE_CASE } from "../fixtures/punching-reference";

/**
 * Interactive use: a calculation must stay well under one frame. Budgets are generous (CI machines vary)
 * but would catch an accidental slowdown of either engine.
 */
const RUNS = 300;
const ACI_BUDGET_MS = 3;
const EC2_BUDGET_MS = 6;

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

function averageMs(run: () => unknown): number {
  run(); // warm up
  const start = performance.now();
  for (let i = 0; i < RUNS; i++) run();
  return (performance.now() - start) / RUNS;
}

describe("calculation speed", () => {
  it(`ACI 318-19 (with two openings) averages under ${ACI_BUDGET_MS} ms`, () => {
    expect(averageMs(() => calculatePunchingShear(REFERENCE_CASE))).toBeLessThan(ACI_BUDGET_MS);
  });

  it(`EN 1992-1-1 (with two openings, arcs) averages under ${EC2_BUDGET_MS} ms`, () => {
    expect(averageMs(() => calculatePunchingShearEC2(EC2_INPUT))).toBeLessThan(EC2_BUDGET_MS);
  });
});
