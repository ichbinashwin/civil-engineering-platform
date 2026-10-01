import { describe, expect, it } from "vitest";
import { calculatePunchingShear } from "@civil/engineering-core";
import type { PunchingShearResult } from "@civil/shared-types";
import { REFERENCE_CASE } from "../fixtures/punching-reference";

/**
 * Regression against the supplied working calculation.
 * Tolerances (see docs/verification/punching-reference-case.md):
 *   perimeters: ±0.005 in; stresses: ±2 psi (source rounded to 3 significant figures,
 *   section-property treatment of source not fully documented); DCR: ±0.01.
 * The working calculation omits lambda_s, so it is reproduced with applySizeEffectFactor: false.
 */
function run(applySizeEffectFactor: boolean): PunchingShearResult {
  const outcome = calculatePunchingShear({ ...REFERENCE_CASE, options: { applySizeEffectFactor } });
  if (!outcome.ok) throw new Error(outcome.reason);
  return outcome;
}

describe("Reference case — reproduce working calculation (lambda_s omitted)", () => {
  const r = run(false);

  it("gross critical perimeter bo = 128.00 in", () => {
    expect(r.geometry.grossPerimeter).toBeCloseTo(128.0, 6);
  });

  it("opening reductions ≈ 0.914 in and 0.962 in", () => {
    expect(r.geometry.openingReductions[0]?.reduction).toBeCloseTo(0.914, 3);
    expect(r.geometry.openingReductions[1]?.reduction).toBeCloseTo(0.962, 3);
  });

  it("effective perimeter ≈ 126.124 in", () => {
    expect(r.geometry.effectivePerimeter).toBeCloseTo(126.124, 2);
  });

  it("vu,max ≈ 165 psi (±2 psi)", () => {
    expect(Math.abs(r.demand.maximumShearStress - 165)).toBeLessThan(2);
  });

  it("vc ≈ 282.8 psi governed by Table 22.6.5.2(a)", () => {
    expect(r.capacity.governingVc).toBeCloseTo(282.8, 1);
    expect(r.capacity.governingEquation).toBe("a");
  });

  it("phi vc ≈ 212.1 psi", () => {
    expect(r.capacity.phi).toBe(0.75);
    expect(r.capacity.designStrength).toBeCloseTo(212.1, 1);
  });

  it("DCR ≈ 0.78 and PASS", () => {
    expect(Math.abs(r.dcr - 0.78)).toBeLessThan(0.01);
    expect(r.status).toBe("PASS");
  });

  it("flags non-conformance because lambda_s was omitted", () => {
    expect(
      r.warnings.some((w) => w.code === "SIZE_EFFECT_OMITTED" && w.severity === "WARNING"),
    ).toBe(true);
  });
});

describe("Reference case — ACI 318-19 default (lambda_s applied)", () => {
  const r = run(true);

  it("applies lambda_s = sqrt(2/(1+16/10)) ≈ 0.877", () => {
    expect(r.capacity.lambdaS).toBeCloseTo(Math.sqrt(2 / 2.6), 9);
  });

  it("vc ≈ 248.1 psi, phi vc ≈ 186.0 psi", () => {
    expect(r.capacity.governingVc).toBeCloseTo(248.07, 1);
    expect(r.capacity.designStrength).toBeCloseTo(186.05, 1);
  });

  it("DCR ≈ 0.895 and PASS", () => {
    expect(r.dcr).toBeCloseTo(0.895, 2);
    expect(r.status).toBe("PASS");
  });

  it("records audit metadata and code references", () => {
    expect(r.meta.designCode).toBe("ACI 318-19");
    expect(r.meta.engineVersion).toMatch(/^\d+\.\d+\.\d+$/);
    const sections = r.codeReferences.map((c) => c.section);
    for (const s of ["8.4.4.2", "22.6", "22.6.4", "22.6.4.3", "22.6.5.2"]) {
      expect(sections).toContain(s);
    }
  });

  it("every trace step has a finite value and a unit", () => {
    for (const step of r.steps) {
      expect(Number.isFinite(step.value)).toBe(true);
      expect(step.unit.length).toBeGreaterThan(0);
    }
  });
});
