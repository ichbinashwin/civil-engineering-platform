import { describe, expect, it } from "vitest";
import { convertForce, convertLength, convertMoment, convertStress } from "@civil/engineering-core";

describe("unit conversion", () => {
  it("force", () => {
    expect(convertForce(297, "kip", "lb")).toBe(297000);
    expect(convertForce(1, "kN", "lb")).toBeCloseTo(224.809, 3);
  });
  it("length", () => {
    expect(convertLength(1, "ft", "in")).toBe(12);
    expect(convertLength(25.4, "mm", "in")).toBeCloseTo(1, 12);
  });
  it("moment", () => {
    expect(convertMoment(83.7, "kip-ft", "lb-in")).toBeCloseTo(1_004_400, 6);
    expect(convertMoment(1, "kN-m", "kip-ft")).toBeCloseTo(0.737562, 5);
  });
  it("stress", () => {
    expect(convertStress(1, "MPa", "psi")).toBeCloseTo(145.0377, 3);
    expect(convertStress(convertStress(250, "psi", "MPa"), "MPa", "psi")).toBeCloseTo(250, 9);
  });
});
