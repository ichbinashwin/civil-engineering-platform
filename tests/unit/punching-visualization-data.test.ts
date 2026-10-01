import { describe, expect, it } from "vitest";
import { calculatePunchingShear } from "@civil/engineering-core";
import { REFERENCE_CASE } from "../fixtures/punching-reference";

describe("visualization data from the engine", () => {
  const r = calculatePunchingShear(REFERENCE_CASE);
  if (!r.ok) throw new Error(r.reason);

  it("stress profile maximum equals vu,max (same formula as the check)", () => {
    const max = Math.max(...r.demand.stressProfile.flat().map((p) => p.stress));
    expect(max).toBeCloseTo(r.demand.maximumShearStress, 9);
  });

  it("stress profile covers every effective segment", () => {
    expect(r.demand.stressProfile).toHaveLength(r.geometry.segments.length);
  });

  it("opening shadows: removed length equals reported reduction; tangent points lie on bo", () => {
    for (const s of r.geometry.openingShadows) {
      const removed = s.removedSegments.reduce(
        (sum, g) => sum + Math.hypot(g.x2 - g.x1, g.y2 - g.y1),
        0,
      );
      expect(removed).toBeCloseTo(r.geometry.openingReductions[s.openingIndex]!.reduction, 9);
      for (const t of [s.tangentStart, s.tangentEnd]) {
        const onX = Math.abs(Math.abs(t.x) - r.geometry.sizeX / 2) < 1e-9;
        const onY = Math.abs(Math.abs(t.y) - r.geometry.sizeY / 2) < 1e-9;
        expect(onX || onY).toBe(true);
      }
    }
  });
});
