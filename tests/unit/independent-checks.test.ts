import { describe, expect, it } from "vitest";
import { calculatePunchingShear } from "@civil/engineering-core";
import type { Opening, PunchingShearInput, PunchingShearResult } from "@civil/shared-types";
import { REFERENCE_CASE, referenceWith } from "../fixtures/punching-reference";

/**
 * Independent cross-checks that do NOT reuse engine geometry code: brute-force sampling of the
 * critical perimeter and numerical integration of section properties and opening shadows.
 */
const SAMPLES_PER_INCH = 400;

function ok(input: PunchingShearInput): PunchingShearResult {
  const r = calculatePunchingShear(input);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

/** Points (midpoints of tiny steps) along the gross rectangular critical perimeter. */
function samplePerimeter(hx: number, hy: number): { x: number; y: number; ds: number }[] {
  const corners = [
    [-hx, -hy],
    [hx, -hy],
    [hx, hy],
    [-hx, hy],
  ] as const;
  const pts: { x: number; y: number; ds: number }[] = [];
  for (let i = 0; i < 4; i++) {
    const [ax, ay] = corners[i]!;
    const [bx, by] = corners[(i + 1) % 4]!;
    const len = Math.hypot(bx - ax, by - ay);
    const n = Math.ceil(len * SAMPLES_PER_INCH);
    for (let k = 0; k < n; k++) {
      const t = (k + 0.5) / n;
      pts.push({ x: ax + (bx - ax) * t, y: ay + (by - ay) * t, ds: len / n });
    }
  }
  return pts;
}

/** True if the straight line from the column centroid through p hits the opening (§22.6.4.3). */
function inShadow(p: { x: number; y: number }, o: Opening): boolean {
  const len = Math.hypot(p.x, p.y);
  const ux = p.x / len;
  const uy = p.y / len;
  if (o.type === "circle") {
    const along = o.centerX * ux + o.centerY * uy;
    const perp = Math.abs(o.centerX * uy - o.centerY * ux);
    return along > 0 && perp <= o.diameter / 2;
  }
  // Slab test for ray vs axis-aligned rectangle.
  const x0 = o.centerX - o.width / 2;
  const x1 = o.centerX + o.width / 2;
  const y0 = o.centerY - o.height / 2;
  const y1 = o.centerY + o.height / 2;
  let tMin = 0;
  let tMax = Number.POSITIVE_INFINITY;
  for (const [u, lo, hi] of [
    [ux, x0, x1],
    [uy, y0, y1],
  ] as const) {
    if (Math.abs(u) < 1e-12) {
      if (0 < lo || 0 > hi) return false;
    } else {
      const ta = lo / u;
      const tb = hi / u;
      tMin = Math.max(tMin, Math.min(ta, tb));
      tMax = Math.min(tMax, Math.max(ta, tb));
    }
  }
  return tMax >= tMin;
}

function bruteForce(input: PunchingShearInput) {
  const hx = (input.column.c1 + input.d) / 2;
  const hy = (input.column.c2 + input.d) / 2;
  const pts = samplePerimeter(hx, hy).filter((p) => !input.openings.some((o) => inShadow(p, o)));
  const bo = pts.reduce((s, p) => s + p.ds, 0);
  const xc = pts.reduce((s, p) => s + p.x * p.ds, 0) / bo;
  const yc = pts.reduce((s, p) => s + p.y * p.ds, 0) / bo;
  const Ix = pts.reduce((s, p) => s + (p.y - yc) ** 2 * p.ds, 0);
  const Iy = pts.reduce((s, p) => s + (p.x - xc) ** 2 * p.ds, 0);
  const Ixy = pts.reduce((s, p) => s + (p.x - xc) * (p.y - yc) * p.ds, 0);
  return { bo, xc, yc, Ix, Iy, Ixy };
}

const CASES: [string, PunchingShearInput][] = [
  ["reference case (2 circular openings)", REFERENCE_CASE],
  [
    "rectangular opening at a corner",
    referenceWith({
      openings: [{ type: "rectangle", centerX: 40, centerY: 45, width: 12, height: 8 }],
    }),
  ],
  [
    "opening on +x side",
    referenceWith({ openings: [{ type: "circle", centerX: 30, centerY: -5, diameter: 8 }] }),
  ],
  [
    "three openings, overlapping shadows",
    referenceWith({
      openings: [
        { type: "circle", centerX: -40, centerY: 0, diameter: 6 },
        { type: "circle", centerX: -60, centerY: 3, diameter: 6 },
        { type: "rectangle", centerX: 0, centerY: -50, width: 20, height: 6 },
      ],
    }),
  ],
];

describe("independent brute-force checks of §22.6.4.3 geometry and section properties", () => {
  it.each(CASES)("%s", (_name, input) => {
    const r = ok(input);
    const b = bruteForce(input);
    const tol = 2 / SAMPLES_PER_INCH; // discretization error ~ step size
    expect(r.geometry.effectivePerimeter).toBeCloseTo(b.bo, 1);
    expect(Math.abs(r.geometry.effectivePerimeter - b.bo)).toBeLessThan(tol * 10);
    expect(Math.abs(r.geometry.centroidX - b.xc)).toBeLessThan(1e-3);
    expect(Math.abs(r.geometry.centroidY - b.yc)).toBeLessThan(1e-3);
    expect(r.geometry.Ix / b.Ix).toBeCloseTo(1, 4);
    expect(r.geometry.Iy / b.Iy).toBeCloseTo(1, 4);
    expect(Math.abs(r.geometry.Ixy - b.Ixy)).toBeLessThan(Math.max(1e-6 * b.Ix, 0.5));
  });
});

describe("product of inertia and moment sign convention", () => {
  it("Jxy = 0 for a symmetric section (no openings)", () => {
    expect(ok(referenceWith({ openings: [] })).geometry.Jxy).toBeCloseTo(0, 6);
  });

  it("Jxy ≠ 0 for asymmetric openings", () => {
    expect(Math.abs(ok(REFERENCE_CASE).geometry.Jxy)).toBeGreaterThan(1);
  });

  it("envelope ≥ signed for any moment signs", () => {
    for (const sx of [1, -1]) {
      for (const sy of [1, -1]) {
        const base = {
          ...REFERENCE_CASE,
          Mux: sx * REFERENCE_CASE.Mux,
          Muy: sy * REFERENCE_CASE.Muy,
        };
        const env = ok(base).demand.maximumShearStress;
        const sig = ok({ ...base, options: { momentSignConvention: "signed" } }).demand
          .maximumShearStress;
        expect(env).toBeGreaterThanOrEqual(sig - 1e-9);
      }
    }
  });

  it("envelope = max over the four sign combinations of the signed result (symmetric section)", () => {
    const sym = referenceWith({ openings: [] });
    const env = ok(sym).demand.maximumShearStress;
    const signedMax = Math.max(
      ...[1, -1].flatMap((sx) =>
        [1, -1].map(
          (sy) =>
            ok({
              ...sym,
              Mux: sx * sym.Mux,
              Muy: sy * sym.Muy,
              options: { momentSignConvention: "signed" },
            }).demand.maximumShearStress,
        ),
      ),
    );
    expect(env).toBeCloseTo(signedMax, 9);
  });

  it("signed: positive Mux raises stress on +y side, positive Muy on +x side", () => {
    const r = ok(referenceWith({ openings: [], options: { momentSignConvention: "signed" } }));
    expect(r.demand.criticalPoint.y).toBeGreaterThan(0);
    expect(r.demand.criticalPoint.x).toBeGreaterThan(0);
  });
});
