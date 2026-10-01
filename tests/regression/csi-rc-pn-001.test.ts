import { describe, expect, it } from "vitest";
import { calculatePunchingShear, convertForce } from "@civil/engineering-core";
import type { PunchingShearInput, PunchingShearResult } from "@civil/shared-types";

/**
 * Independent benchmark: CSI Software Verification, Example ACI 318-14 RC-PN-001 (identical to
 * ACI 318-08 RC-PN-001), "Slab Punching Shear Design", interior column at grid B-2.
 * Source: docs.csiamerica.com/manuals/safe/Verification/Design Verification/ACI 318-14/ACI 318-14 RC-PN-001.pdf
 *
 * Published inputs: column 12 in (X) × 36 in (Y), h = 10 in, d = [(10-1)+(10-2)]/2 = 8.5 in,
 * f'c = 4000 psi, Vu = 189.45 k, γv2·Mu2 = -156.39 k-in, γv3·Mu3 = 91.538 k-in.
 * Published results: bo = 130 in, γv2 = 0.4955, γv3 = 0.3115, IXX = 301922.3, IYY = 93782.8,
 * vu = 0.1714 + 0.0115 + 0.0100 = 0.1930 ksi (point C), φvc = 0.158 ksi (Eq. b governs), ratio 1.22.
 *
 * ACI 318-19 adds λs (§22.5.5.1.3); here d = 8.5 in < 10 in so λs = 1 and results are unchanged.
 * Mu2 (paired with IXX, stress ∝ y) corresponds to Mux; Mu3 (IYY, stress ∝ x) to Muy.
 * The engine takes unfactored-by-γ moments, so Mu = (γv·Mu)/γv using the published γv.
 */
const GAMMA_V2 = 1 - 1 / (1 + (2 / 3) * Math.sqrt(44.5 / 20.5));
const GAMMA_V3 = 1 - 1 / (1 + (2 / 3) * Math.sqrt(20.5 / 44.5));
const KIP_IN_TO_LB_IN = 1000;

const CSI_INPUT: PunchingShearInput = {
  Vu: convertForce(189.45, "kip", "lb"),
  Mux: (-156.39 / GAMMA_V2) * KIP_IN_TO_LB_IN,
  Muy: (91.538 / GAMMA_V3) * KIP_IN_TO_LB_IN,
  column: { c1: 12, c2: 36 },
  d: 8.5,
  slabThickness: 10,
  concrete: { fc: 4000, lambda: 1 },
  openings: [],
  columnLocation: "interior",
  punchingReinforcement: "none",
};

function run(): PunchingShearResult {
  const r = calculatePunchingShear(CSI_INPUT);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

describe("CSI ACI 318-14 RC-PN-001 benchmark (independent hand calculation)", () => {
  const r = run();

  it("critical perimeter bo = 44.5 + 20.5 + 44.5 + 20.5 = 130 in", () => {
    expect(r.geometry.sizeX).toBeCloseTo(20.5, 9);
    expect(r.geometry.sizeY).toBeCloseTo(44.5, 9);
    expect(r.geometry.effectivePerimeter).toBeCloseTo(130, 9);
  });

  it("γv2 = 0.4955 (Mux) and γv3 = 0.3115 (Muy)", () => {
    expect(r.demand.gammaVx).toBeCloseTo(0.4955, 4);
    expect(r.demand.gammaVy).toBeCloseTo(0.3115, 4);
  });

  it("centroid at column centre (0, 0)", () => {
    expect(r.geometry.centroidX).toBeCloseTo(0, 9);
    expect(r.geometry.centroidY).toBeCloseTo(0, 9);
  });

  it("Jx = IXX = 301922.3 in⁴ and Jy = IYY = 93782.8 in⁴", () => {
    expect(r.geometry.Jx).toBeCloseTo(301922.3, 0);
    expect(r.geometry.Jy).toBeCloseTo(93782.8, 0);
  });

  it("stress components 0.1714 + 0.0115 + 0.0100 ksi", () => {
    expect(r.demand.directShear / 1000).toBeCloseTo(0.1714, 4);
    expect(r.demand.momentX / 1000).toBeCloseTo(0.0115, 4);
    expect(r.demand.momentY / 1000).toBeCloseTo(0.01, 4);
  });

  it("vu,max = 0.1930 ksi at corner (10.25, -22.25)", () => {
    expect(r.demand.maximumShearStress / 1000).toBeCloseTo(0.193, 4);
    expect(Math.abs(r.demand.criticalPoint.x)).toBeCloseTo(10.25, 9);
    expect(Math.abs(r.demand.criticalPoint.y)).toBeCloseTo(22.25, 9);
  });

  it("φvc = 0.158 ksi, governed by Table 22.6.5.2(b) with β = 3; (c) 0.219 ksi, (a) 0.190 ksi", () => {
    expect(r.capacity.lambdaS).toBe(1);
    expect(r.capacity.betaC).toBe(3);
    expect(r.capacity.governingEquation).toBe("b");
    expect(r.capacity.designStrength / 1000).toBeCloseTo(0.158, 3);
    expect((r.capacity.phi * r.capacity.vcC) / 1000).toBeCloseTo(0.219, 3);
    expect((r.capacity.phi * r.capacity.vcA) / 1000).toBeCloseTo(0.19, 3);
  });

  it("shear ratio = 0.193 / 0.158 = 1.22 → FAIL", () => {
    expect(r.dcr).toBeCloseTo(1.22, 2);
    expect(r.status).toBe("FAIL");
  });
});
