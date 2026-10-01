import { describe, expect, it } from "vitest";
import {
  concreteCapacity,
  momentTransferFractionShear,
  sizeEffectFactor,
} from "@civil/engineering-core";

describe("size effect factor (§22.5.5.1.3)", () => {
  it("is 1.0 for d <= 10 in", () => {
    expect(sizeEffectFactor(8)).toBe(1);
    expect(sizeEffectFactor(10)).toBe(1);
  });

  it("is sqrt(2/(1 + d/10)) for d > 10 in", () => {
    expect(sizeEffectFactor(16)).toBeCloseTo(Math.sqrt(2 / 2.6), 12);
  });
});

describe("Table 22.6.5.2", () => {
  const base = { fc: 5000, lambda: 1, lambdaS: 1, d: 16, columnLocation: "interior" as const };

  it("(a) governs for a near-square column with small bo", () => {
    const c = concreteCapacity({ ...base, c1: 12, c2: 20, bo: 128 });
    expect(c.vcA).toBeCloseTo(4 * Math.sqrt(5000), 9);
    expect(c.governingEquation).toBe("a");
  });

  it("(b) governs for an elongated column (beta > 2)", () => {
    const c = concreteCapacity({ ...base, c1: 12, c2: 48, bo: 192 });
    expect(c.betaC).toBe(4);
    expect(c.vcB).toBeCloseTo(3 * Math.sqrt(5000), 9);
    expect(c.governingEquation).toBe("b");
  });

  it("(c) governs for a large perimeter relative to d", () => {
    const c = concreteCapacity({ ...base, c1: 60, c2: 60, d: 8, bo: 272 });
    expect(c.vcC).toBeCloseTo((2 + (40 * 8) / 272) * Math.sqrt(5000), 9);
    expect(c.governingEquation).toBe("c");
  });

  it("limits sqrt(f'c) to 100 psi (§22.6.3.1)", () => {
    const c = concreteCapacity({ ...base, fc: 12000, c1: 12, c2: 20, bo: 128 });
    expect(c.sqrtFc).toBe(100);
    expect(c.sqrtFcLimited).toBe(true);
  });
});

describe("moment transfer fraction (§8.4.2.2)", () => {
  it("square section: gamma_v = 0.40", () => {
    expect(momentTransferFractionShear(28, 28)).toBeCloseTo(0.4, 12);
  });
});
