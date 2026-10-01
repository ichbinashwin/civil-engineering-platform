import { describe, expect, it } from "vitest";
import { betaKCoefficient, calculatePunchingShearEC2 } from "@civil/engineering-core";
import type { PunchingShearInputEC2, PunchingShearResultEC2 } from "@civil/shared-types";

const BASE: PunchingShearInputEC2 = {
  VEd: 600e3,
  MEdx: 0,
  MEdy: 40e6,
  column: { c1: 400, c2: 300 },
  d: 220,
  slabThickness: 270,
  fck: 30,
  rhoLx: 0.01,
  rhoLy: 0.01,
  openings: [],
  columnLocation: "interior",
  punchingReinforcement: "none",
};

function ok(input: PunchingShearInputEC2): PunchingShearResultEC2 {
  const r = calculatePunchingShearEC2(input);
  if (!r.ok) throw new Error(`${r.reason} ${JSON.stringify(r.warnings)}`);
  return r;
}

describe("Table 6.1 coefficient k", () => {
  it("matches the listed rows and interpolates between them", () => {
    expect(betaKCoefficient(100, 400)).toBe(0.45); // ratio 0.25 (<= 0.5)
    expect(betaKCoefficient(200, 400)).toBeCloseTo(0.45, 12);
    expect(betaKCoefficient(400, 400)).toBeCloseTo(0.6, 12);
    expect(betaKCoefficient(800, 400)).toBeCloseTo(0.7, 12);
    expect(betaKCoefficient(1200, 400)).toBeCloseTo(0.8, 12);
    expect(betaKCoefficient(2000, 400)).toBe(0.8);
    expect(betaKCoefficient(300, 400)).toBeCloseTo(0.45 + (0.15 * (0.75 - 0.5)) / 0.5, 12);
    expect(betaKCoefficient(600, 400)).toBeCloseTo(0.65, 12);
  });
});

describe("axis conventions and symmetry", () => {
  it("swapping the column sides and the moment axis gives identical results", () => {
    const a = ok({ ...BASE, MEdx: 0, MEdy: 40e6, column: { c1: 400, c2: 300 } });
    const b = ok({ ...BASE, MEdx: 40e6, MEdy: 0, column: { c1: 300, c2: 400 } });
    expect(b.demand.beta).toBeCloseTo(a.demand.beta, 10);
    expect(b.dcr).toBeCloseTo(a.dcr, 10);
  });

  it("moment sign does not matter (β is a magnitude)", () => {
    const pos = ok({ ...BASE, MEdx: 20e6, MEdy: 40e6 });
    const neg = ok({ ...BASE, MEdx: -20e6, MEdy: -40e6 });
    expect(neg.demand.beta).toBeCloseTo(pos.demand.beta, 12);
  });

  it("(6.43) pairs each eccentricity with the perimeter dimension of the other axis", () => {
    const r = ok({ ...BASE, MEdx: 30e6, MEdy: 50e6 });
    const by = 400 + 4 * 220;
    const bz = 300 + 4 * 220;
    const ey = 50e6 / 600e3; // eccentricity along X from the moment about Y
    const ez = 30e6 / 600e3; // eccentricity along Y from the moment about X
    expect(r.demand.betaMethod).toBe("6.43");
    expect(r.demand.beta).toBeCloseTo(1 + 1.8 * Math.sqrt((ey / bz) ** 2 + (ez / by) ** 2), 12);
  });

  it("zero moment gives β = 1.0 (concentric)", () => {
    const r = ok({ ...BASE, MEdx: 0, MEdy: 0 });
    expect(r.demand.beta).toBe(1);
    expect(r.demand.betaMethod).toBe("concentric");
  });
});

describe("openings (EN 1992-1-1 §6.4.2(3))", () => {
  const circle = (x: number, y: number, diameter = 150) => ({
    type: "circle" as const,
    centerX: x,
    centerY: y,
    diameter,
  });

  it("an opening within 6d reduces u1; one beyond 6d is not deducted (INFO)", () => {
    const base = ok(BASE).geometry.effectivePerimeter;
    const near = ok({ ...BASE, openings: [circle(-700, 100)] });
    expect(near.geometry.effectivePerimeter).toBeLessThan(base);
    expect(near.geometry.openingReductions[0]?.applied).toBe(true);
    const far = ok({ ...BASE, openings: [circle(-2600, 0, 200)] });
    expect(far.geometry.effectivePerimeter).toBeCloseTo(base, 9);
    expect(far.geometry.openingReductions[0]?.applied).toBe(false);
    expect(far.warnings.some((w) => w.code === "OPENING_BEYOND_6D" && w.severity === "INFO")).toBe(
      true,
    );
  });

  it("identical overlapping openings are counted once", () => {
    const one = ok({ ...BASE, openings: [circle(-700, 100)] });
    const two = ok({ ...BASE, openings: [circle(-700, 100), circle(-700, 100)] });
    expect(two.geometry.effectivePerimeter).toBeCloseTo(one.geometry.effectivePerimeter, 9);
  });

  it("an opening reaching the control perimeter raises a WARNING", () => {
    const r = ok({ ...BASE, openings: [circle(-360, 0, 120)] });
    expect(r.warnings.some((w) => w.code === "OPENING_INSIDE_CONTROL_PERIMETER_ZONE")).toBe(true);
  });

  it("shadows that wrap around the start of the perimeter are handled", () => {
    const r = ok({ ...BASE, openings: [circle(-250, -700, 300)] });
    expect(r.geometry.effectivePerimeter).toBeLessThan(ok(BASE).geometry.effectivePerimeter);
    expect(Number.isFinite(r.dcr)).toBe(true);
  });

  it("more openings never increase capacity-relevant perimeter", () => {
    const a = ok({ ...BASE, openings: [circle(-700, 100)] }).geometry.effectivePerimeter;
    const b = ok({ ...BASE, openings: [circle(-700, 100), circle(700, -150)] }).geometry
      .effectivePerimeter;
    expect(b).toBeLessThan(a);
  });

  it("opening biaxial moments warn that (6.43) ignores openings", () => {
    const r = ok({ ...BASE, MEdx: 20e6, MEdy: 40e6, openings: [circle(-700, 100)] });
    expect(r.warnings.some((w) => w.code === "BETA_BIAXIAL_IGNORES_OPENINGS")).toBe(true);
  });

  it("an opening overlapping the column makes the calculation unavailable", () => {
    const r = calculatePunchingShearEC2({ ...BASE, openings: [circle(100, 0, 150)] });
    expect(r.ok).toBe(false);
  });
});

describe("invalid input never yields a DCR", () => {
  const cases: [string, unknown][] = [
    ["d >= h", { ...BASE, d: 270 }],
    ["VEd = 0", { ...BASE, VEd: 0 }],
    ["negative VEd", { ...BASE, VEd: -1 }],
    ["fck below C12/15", { ...BASE, fck: 10 }],
    ["fck above C90/105", { ...BASE, fck: 95 }],
    ["NaN depth", { ...BASE, d: Number.NaN }],
    ["negative reinforcement ratio", { ...BASE, rhoLx: -0.01 }],
    ["zero column size", { ...BASE, column: { c1: 0, c2: 300 } }],
    ["edge column", { ...BASE, columnLocation: "edge" }],
    ["shear reinforcement", { ...BASE, punchingReinforcement: "studRails" }],
    ["not an object", 42],
  ];
  it.each(cases)("%s", (_name, input) => {
    const outcome = calculatePunchingShearEC2(input);
    expect(outcome.ok).toBe(false);
    expect(outcome).not.toHaveProperty("dcr");
  });

  it("zero reinforcement ratio is allowed: vmin governs", () => {
    const r = ok({ ...BASE, rhoLx: 0, rhoLy: 0 });
    expect(r.capacity.governingExpression).toBe("6.3N");
    expect(r.capacity.vRdc).toBe(r.capacity.vMin);
  });

  it("ρl above 2 % is capped with an INFO", () => {
    const r = ok({ ...BASE, rhoLx: 0.03, rhoLy: 0.03 });
    expect(r.capacity.rhoL).toBe(0.02);
    expect(r.warnings.some((w) => w.code === "RHO_ABOVE_CAP")).toBe(true);
  });
});
