import { describe, expect, it } from "vitest";
import { calculatePunchingShearEC2, w1Rectangular } from "@civil/engineering-core";
import type { Opening, PunchingShearInputEC2, PunchingShearResultEC2 } from "@civil/shared-types";

/**
 * EN 1992-1-1 punching shear regression. Expected values come from tests/regression/ec2_reference.py,
 * an independent implementation (formulas from the standard + brute-force perimeter sampling).
 * Units: N, N·mm, mm, MPa. Closed-form cases agree to 1e-6; sampled cases (openings) to 2e-4.
 */
interface RefCase {
  name: string;
  c1: number;
  c2: number;
  d: number;
  fck: number;
  rhoX: number;
  rhoY: number;
  V: number;
  Mx: number;
  My: number;
  openings?: Opening[];
  expect: {
    u1: number;
    beta: number;
    method: "concentric" | "6.39" | "6.43";
    ved: number;
    ved0: number;
    k: number;
    rhoL: number;
    vRdcFormula: number;
    vMin: number;
    vRdc: number;
    vRdMax: number;
    dcr: number;
    xc?: number;
    yc?: number;
  };
}

const CASES: RefCase[] = [
  {
    name: "A one axis, square, k capped",
    c1: 400,
    c2: 400,
    d: 200,
    fck: 30,
    rhoX: 0.01,
    rhoY: 0.01,
    V: 600e3,
    Mx: 0,
    My: 40e6,
    expect: {
      u1: 4113.274123,
      beta: 1.096632,
      method: "6.39",
      ved: 0.799824,
      ved0: 2.056185,
      k: 2,
      rhoL: 0.01,
      vRdcFormula: 0.745736,
      vMin: 0.542218,
      vRdc: 0.745736,
      vRdMax: 4.224,
      dcr: 1.07253,
    },
  },
  {
    name: "B biaxial (6.43), rectangular",
    c1: 500,
    c2: 300,
    d: 180,
    fck: 35,
    rhoX: 0.012,
    rhoY: 0.008,
    V: 800e3,
    Mx: 60e6,
    My: 35e6,
    expect: {
      u1: 3861.946711,
      beta: 1.134928,
      method: "6.43",
      ved: 1.306109,
      ved0: 3.152576,
      k: 2,
      rhoL: 0.009798,
      vRdcFormula: 0.779733,
      vMin: 0.585662,
      vRdc: 0.779733,
      vRdMax: 4.816,
      dcr: 1.675072,
    },
  },
  {
    name: "E concentric",
    c1: 350,
    c2: 350,
    d: 150,
    fck: 25,
    rhoX: 0.005,
    rhoY: 0.005,
    V: 300e3,
    Mx: 0,
    My: 0,
    expect: {
      u1: 3284.955592,
      beta: 1,
      method: "concentric",
      ved: 0.608836,
      ved0: 1.428571,
      k: 2,
      rhoL: 0.005,
      vRdcFormula: 0.556991,
      vMin: 0.494975,
      vRdc: 0.556991,
      vRdMax: 3.6,
      dcr: 1.093082,
    },
  },
  {
    name: "F d > 200 (k uncapped), moment about X, c-ratio interpolated",
    c1: 600,
    c2: 400,
    d: 300,
    fck: 45,
    rhoX: 0.008,
    rhoY: 0.012,
    V: 1500e3,
    Mx: 90e6,
    My: 0,
    expect: {
      u1: 5769.911184,
      beta: 1.053525,
      method: "6.39",
      ved: 0.912947,
      ved0: 2.633811,
      k: 1.816497,
      rhoL: 0.009798,
      vRdcFormula: 0.770073,
      vMin: 0.574812,
      vRdc: 0.770073,
      vRdMax: 5.904,
      dcr: 1.185533,
    },
  },
  {
    name: "G vmin governs",
    c1: 300,
    c2: 300,
    d: 250,
    fck: 30,
    rhoX: 0.002,
    rhoY: 0.002,
    V: 400e3,
    Mx: 0,
    My: 0,
    expect: {
      u1: 4341.592654,
      beta: 1,
      method: "concentric",
      ved: 0.368528,
      ved0: 1.333333,
      k: 1.894427,
      rhoL: 0.002,
      vRdcFormula: 0.413088,
      vMin: 0.499857,
      vRdc: 0.499857,
      vRdMax: 4.224,
      dcr: 0.737268,
    },
  },
  {
    name: "J column-perimeter check governs",
    c1: 200,
    c2: 200,
    d: 300,
    fck: 20,
    rhoX: 0.02,
    rhoY: 0.02,
    V: 1000e3,
    Mx: 0,
    My: 0,
    expect: {
      u1: 4569.911184,
      beta: 1,
      method: "concentric",
      ved: 0.729409,
      ved0: 4.166667,
      k: 1.816497,
      rhoL: 0.02,
      vRdcFormula: 0.74548,
      vMin: 0.383208,
      vRdc: 0.74548,
      vRdMax: 2.944,
      dcr: 1.415308,
    },
  },
  {
    name: "C circular opening within 6d",
    c1: 400,
    c2: 400,
    d: 200,
    fck: 30,
    rhoX: 0.01,
    rhoY: 0.01,
    V: 500e3,
    Mx: 0,
    My: 30e6,
    openings: [{ type: "circle", centerX: -700, centerY: 150, diameter: 150 }],
    expect: {
      u1: 3980.999123,
      beta: 1.088388,
      method: "6.39",
      ved: 0.683489,
      ved0: 1.700606,
      k: 2,
      rhoL: 0.01,
      vRdcFormula: 0.745736,
      vMin: 0.542218,
      vRdc: 0.745736,
      vRdMax: 4.224,
      dcr: 0.91653,
      xc: 19.93595,
      yc: -4.321533,
    },
  },
  {
    name: "D three openings, one beyond 6d",
    c1: 450,
    c2: 300,
    d: 190,
    fck: 40,
    rhoX: 0.015,
    rhoY: 0.01,
    V: 900e3,
    Mx: 70e6,
    My: 0,
    openings: [
      { type: "circle", centerX: -500, centerY: 200, diameter: 120 },
      { type: "rectangle", centerX: 100, centerY: 650, width: 200, height: 120 },
      { type: "circle", centerX: 2000, centerY: 0, diameter: 200 },
    ],
    expect: {
      u1: 3563.434786,
      beta: 1.105058,
      method: "6.39",
      ved: 1.468944,
      ved0: 3.489658,
      k: 2,
      rhoL: 0.012247,
      vRdcFormula: 0.878172,
      vMin: 0.626099,
      vRdc: 0.878172,
      vRdMax: 5.376,
      dcr: 1.672729,
      xc: 19.49936,
      yc: -36.353411,
    },
  },
  {
    name: "I rectangular opening, d > 200",
    c1: 400,
    c2: 400,
    d: 300,
    fck: 35,
    rhoX: 0.01,
    rhoY: 0.01,
    V: 900e3,
    Mx: 0,
    My: 50e6,
    openings: [{ type: "rectangle", centerX: 900, centerY: -200, width: 300, height: 250 }],
    expect: {
      u1: 5086.235767,
      beta: 1.063282,
      method: "6.39",
      ved: 0.627152,
      ved0: 1.993653,
      k: 1.816497,
      rhoL: 0.01,
      vRdcFormula: 0.713026,
      vMin: 0.506937,
      vRdc: 0.713026,
      vRdMax: 4.816,
      dcr: 0.879565,
      xc: -44.466418,
      yc: 11.089239,
    },
  },
];

function toInput(c: RefCase): PunchingShearInputEC2 {
  return {
    VEd: c.V,
    MEdx: c.Mx,
    MEdy: c.My,
    column: { c1: c.c1, c2: c.c2 },
    d: c.d,
    slabThickness: c.d + 50,
    fck: c.fck,
    rhoLx: c.rhoX,
    rhoLy: c.rhoY,
    openings: c.openings ?? [],
    columnLocation: "interior",
    punchingReinforcement: "none",
  };
}

function run(c: RefCase): PunchingShearResultEC2 {
  const r = calculatePunchingShearEC2(toInput(c));
  if (!r.ok) throw new Error(`${c.name}: ${r.reason} ${JSON.stringify(r.warnings)}`);
  return r;
}

const rel = (actual: number, expected: number) => Math.abs(actual - expected) / Math.abs(expected);

describe("EN 1992-1-1 punching shear vs independent reference calculation", () => {
  it.each(CASES)("$name", (c) => {
    const r = run(c);
    const e = c.expect;
    const tol = c.openings ? 2e-4 : 1e-6;
    expect(rel(r.geometry.effectivePerimeter, e.u1)).toBeLessThan(tol);
    expect(r.demand.betaMethod).toBe(e.method);
    expect(rel(r.demand.beta, e.beta)).toBeLessThan(tol * 2);
    expect(rel(r.demand.directShear, e.ved)).toBeLessThan(tol * 2);
    expect(rel(r.demand.columnFaceShear, e.ved0)).toBeLessThan(tol * 2);
    // Resistance is closed-form: exact to the reference's printed 6 decimals.
    expect(rel(r.capacity.k, e.k)).toBeLessThan(1e-6);
    expect(rel(r.capacity.rhoL, e.rhoL)).toBeLessThan(1e-4);
    expect(rel(r.capacity.vRdcFormula, e.vRdcFormula)).toBeLessThan(1e-5);
    expect(rel(r.capacity.vMin, e.vMin)).toBeLessThan(1e-5);
    expect(rel(r.capacity.vRdc, e.vRdc)).toBeLessThan(1e-5);
    expect(rel(r.capacity.vRdMax, e.vRdMax)).toBeLessThan(1e-6);
    expect(rel(r.dcr, e.dcr)).toBeLessThan(tol * 4);
    expect(r.status).toBe(e.dcr <= 1 ? "PASS" : "FAIL");
    if (e.xc !== undefined && e.yc !== undefined) {
      expect(Math.abs(r.geometry.centroidX - e.xc)).toBeLessThan(0.05);
      expect(Math.abs(r.geometry.centroidY - e.yc)).toBeLessThan(0.05);
    }
  });

  it("W1 of the full perimeter equals the closed form (6.40) in both directions", () => {
    const c = CASES[0]!;
    const r = run(c);
    expect(rel(r.geometry.W1y, w1Rectangular(c.c1, c.c2, c.d))).toBeLessThan(1e-5);
    const rect = run({ ...CASES[1]!, My: 0, Mx: 0 });
    expect(rel(rect.geometry.W1x, w1Rectangular(300, 500, 180))).toBeLessThan(1e-5);
    expect(rel(rect.geometry.W1y, w1Rectangular(500, 300, 180))).toBeLessThan(1e-5);
  });

  it("which check governs is reported", () => {
    expect(run(CASES[5]!).governingCheck).toMatch(/Column perimeter/);
    expect(run(CASES[0]!).governingCheck).toMatch(/Control perimeter u1/);
  });

  it("recommended National Annex values are used and flagged", () => {
    const r = run(CASES[0]!);
    expect(r.capacity.cRdc).toBeCloseTo(0.18 / 1.5, 12);
    expect(r.capacity.fcd).toBeCloseTo(30 / 1.5, 12);
    expect(r.capacity.nu).toBeCloseTo(0.6 * (1 - 30 / 250), 12);
    expect(r.warnings.map((w) => w.code)).toEqual(
      expect.arrayContaining(["EC2_EXPERIMENTAL", "EC2_NATIONAL_ANNEX"]),
    );
    expect(r.meta.designCode).toBe("EN 1992-1-1:2004");
  });

  it("every trace step has a finite value, unit and a clause reference", () => {
    const r = run(CASES[7]!);
    for (const step of r.steps) {
      expect(Number.isFinite(step.value)).toBe(true);
      expect(step.unit.length).toBeGreaterThan(0);
      expect(step.reference?.code).toBe("EN 1992-1-1");
    }
  });
});
