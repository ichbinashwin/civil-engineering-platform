import { describe, expect, it } from "vitest";
import { calculatePunchingShear } from "@civil/engineering-core";
import type { PunchingShearInput, PunchingShearResult } from "@civil/shared-types";
import { REFERENCE_CASE, referenceWith } from "../fixtures/punching-reference";

function ok(input: PunchingShearInput): PunchingShearResult {
  const outcome = calculatePunchingShear(input);
  if (!outcome.ok) throw new Error(`${outcome.reason} ${JSON.stringify(outcome.warnings)}`);
  return outcome;
}

describe("punching shear edge cases", () => {
  it("no openings: bo = gross, centroid at origin", () => {
    const r = ok(referenceWith({ openings: [] }));
    expect(r.geometry.effectivePerimeter).toBe(128);
    expect(r.geometry.centroidX).toBeCloseTo(0, 12);
  });

  it("zero moment: vu,max = Vu/(bo d)", () => {
    const r = ok(referenceWith({ openings: [], Mux: 0, Muy: 0 }));
    expect(r.demand.maximumShearStress).toBeCloseTo(297000 / (128 * 16), 9);
  });

  it("one opening reduces bo", () => {
    const r = ok(referenceWith({ openings: [REFERENCE_CASE.openings[0]!] }));
    expect(r.geometry.effectivePerimeter).toBeCloseTo(128 - 0.914, 3);
  });

  it("overlapping shadows are counted once", () => {
    const o = { type: "circle" as const, centerX: -47, centerY: 10, diameter: 3 };
    const single = ok(referenceWith({ openings: [o] }));
    const doubled = ok(referenceWith({ openings: [o, { ...o }] }));
    expect(doubled.geometry.effectivePerimeter).toBeCloseTo(single.geometry.effectivePerimeter, 9);
  });

  it("asymmetric openings shift the centroid away from the openings", () => {
    const r = ok(REFERENCE_CASE);
    expect(r.geometry.centroidX).toBeGreaterThan(0);
    expect(r.geometry.centroidY).toBeLessThan(0);
  });

  it("opening beyond 4h is applied conservatively with INFO", () => {
    const r = ok(
      referenceWith({ openings: [{ type: "circle", centerX: 200, centerY: 0, diameter: 6 }] }),
    );
    expect(r.geometry.effectivePerimeter).toBeLessThan(128);
    expect(r.warnings.some((w) => w.code === "OPENING_BEYOND_4H" && w.severity === "INFO")).toBe(
      true,
    );
  });

  it("opening intersecting the critical perimeter produces a WARNING", () => {
    const r = ok(
      referenceWith({ openings: [{ type: "circle", centerX: -14, centerY: 0, diameter: 4 }] }),
    );
    expect(r.warnings.some((w) => w.code === "OPENING_CROSSES_CRITICAL_SECTION")).toBe(true);
  });

  it("large rectangular opening: shadow = 2 × 14 × 20/35 on the x = -14 face", () => {
    const r = ok(
      referenceWith({
        openings: [{ type: "rectangle", centerX: -40, centerY: 0, width: 10, height: 40 }],
      }),
    );
    expect(r.geometry.effectivePerimeter).toBeCloseTo(128 - (2 * 14 * 20) / 35, 9);
  });

  it("biaxial moments increase stress over uniaxial", () => {
    const uni = ok(referenceWith({ openings: [], Muy: 0 }));
    const bi = ok(referenceWith({ openings: [] }));
    expect(bi.demand.maximumShearStress).toBeGreaterThan(uni.demand.maximumShearStress);
  });

  it("very high shear fails", () => {
    const r = ok(referenceWith({ Vu: 600_000 }));
    expect(r.dcr).toBeGreaterThan(1);
    expect(r.status).toBe("FAIL");
  });

  it("negative moments give the same envelope as positive", () => {
    const pos = ok(REFERENCE_CASE);
    const neg = ok(referenceWith({ Mux: -REFERENCE_CASE.Mux, Muy: -REFERENCE_CASE.Muy }));
    expect(neg.demand.maximumShearStress).toBeCloseTo(pos.demand.maximumShearStress, 9);
  });
});

describe("invalid input never yields a DCR", () => {
  const cases: [string, unknown][] = [
    ["d >= h", referenceWith({ d: 18 })],
    ["negative c1", referenceWith({ column: { c1: -12, c2: 20 } })],
    ["zero fc", referenceWith({ concrete: { fc: 0, lambda: 1 } })],
    ["NaN Vu", referenceWith({ Vu: Number.NaN })],
    ["negative Vu", referenceWith({ Vu: -1 })],
    [
      "zero opening diameter",
      referenceWith({ openings: [{ type: "circle", centerX: -40, centerY: 0, diameter: 0 }] }),
    ],
    ["edge column (not implemented)", referenceWith({ columnLocation: "edge" })],
    [
      "shear reinforcement (not implemented)",
      referenceWith({ punchingReinforcement: "studRails" }),
    ],
    [
      "opening overlapping column",
      referenceWith({ openings: [{ type: "circle", centerX: 6, centerY: 0, diameter: 4 }] }),
    ],
    ["not an object", "hello"],
  ];

  it.each(cases)("%s", (_name, input) => {
    const outcome = calculatePunchingShear(input);
    expect(outcome.ok).toBe(false);
    expect(outcome).not.toHaveProperty("dcr");
    if (!outcome.ok) expect(outcome.reason.length).toBeGreaterThan(0);
  });
});
