import { describe, expect, it } from "vitest";
import {
  createRectangularPerimeter,
  criticalSectionProperties,
  effectiveSegments,
  intervalLength,
  mergeIntervals,
  openingAngularSpan,
  rayIntersection,
  shadowIntervals,
} from "@civil/engineering-core";

const perimeter = createRectangularPerimeter(28, 36);

describe("rectangular perimeter", () => {
  it("has length 2(b1 + b2)", () => {
    expect(perimeter.length).toBe(128);
  });

  it("maps axis rays to the correct arc-length positions", () => {
    expect(rayIntersection(perimeter, 0)).toBeCloseTo(28 + 18, 9); // (+14, 0)
    expect(rayIntersection(perimeter, Math.PI / 2)).toBeCloseTo(28 + 36 + 14, 9); // (0, +18)
    expect(rayIntersection(perimeter, Math.PI)).toBeCloseTo(56 + 36 + 18, 9); // (-14, 0)
    expect(rayIntersection(perimeter, -Math.PI / 2)).toBeCloseTo(14, 9); // (0, -18)
  });
});

describe("opening tangent lines", () => {
  it("circle half-angle = asin(r / D)", () => {
    const span = openingAngularSpan({ type: "circle", centerX: 100, centerY: 0, diameter: 20 });
    expect(span).not.toBeNull();
    expect(span!.to - span!.from).toBeCloseTo(2 * Math.asin(10 / 100), 12);
  });

  it("opening on X axis projects symmetric shadow on the x = +14 face", () => {
    const span = openingAngularSpan({ type: "circle", centerX: 50, centerY: 0, diameter: 10 })!;
    const length = intervalLength(shadowIntervals(perimeter, span));
    expect(length).toBeCloseTo(2 * 14 * Math.tan(Math.asin(5 / 50)), 9);
  });

  it("rectangular opening uses extreme corner tangents", () => {
    const span = openingAngularSpan({
      type: "rectangle",
      centerX: 40,
      centerY: 0,
      width: 4,
      height: 6,
    })!;
    expect(span.to).toBeCloseTo(Math.atan2(3, 38), 12);
    expect(span.from).toBeCloseTo(-Math.atan2(3, 38), 12);
  });

  it("returns null when the column centroid is inside the opening", () => {
    expect(
      openingAngularSpan({ type: "rectangle", centerX: 1, centerY: 0, width: 4, height: 4 }),
    ).toBeNull();
  });

  it("splits a shadow that wraps through s = 0 into two intervals", () => {
    const theta = Math.atan2(-18, -14); // bottom-left corner
    const intervals = shadowIntervals(perimeter, { from: theta - 0.05, to: theta + 0.05 });
    expect(intervals).toHaveLength(2);
  });

  it("merges overlapping shadows so they are not double-counted", () => {
    const merged = mergeIntervals([
      { start: 10, end: 12 },
      { start: 11, end: 13 },
      { start: 20, end: 21 },
    ]);
    expect(intervalLength(merged)).toBeCloseTo(4, 12);
  });
});

describe("critical section properties", () => {
  const d = 16;
  const b1 = 36; // along Y, for moment about X
  const b2 = 28;
  const full = criticalSectionProperties(effectiveSegments(perimeter, []), d);

  it("full rectangle centroid at origin", () => {
    expect(full.centroidX).toBeCloseTo(0, 12);
    expect(full.centroidY).toBeCloseTo(0, 12);
  });

  it("Jx reproduces ACI 318-19 R8.4.4.2.3 Jc = d b1^3/6 + b1 d^3/6 + d b2 b1^2/2", () => {
    const jc = (d * b1 ** 3) / 6 + (b1 * d ** 3) / 6 + (d * b2 * b1 ** 2) / 2;
    expect(full.Jx).toBeCloseTo(jc, 6);
  });

  it("Jy reproduces Jc with b1, b2 swapped", () => {
    const jc = (d * b2 ** 3) / 6 + (b2 * d ** 3) / 6 + (d * b1 * b2 ** 2) / 2;
    expect(full.Jy).toBeCloseTo(jc, 6);
  });

  it("removing part of the left face shifts the centroid to +x", () => {
    const span = openingAngularSpan({ type: "circle", centerX: -60, centerY: 0, diameter: 10 })!;
    const props = criticalSectionProperties(
      effectiveSegments(perimeter, shadowIntervals(perimeter, span)),
      d,
    );
    expect(props.centroidX).toBeGreaterThan(0);
    expect(props.centroidY).toBeCloseTo(0, 9);
  });
});
