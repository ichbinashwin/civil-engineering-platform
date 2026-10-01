import { describe, expect, it } from "vitest";
import {
  EXAMPLE_FORM_ACI,
  EXAMPLE_FORM_EC2,
  convertFormToCode,
  exampleFor,
  toEngineInput,
  toEngineInputEC2,
} from "../../apps/web/lib/form";
import { runCalc } from "../../apps/web/lib/calc";

describe("switching the design code converts the form", () => {
  it("US → EU converts every dimensional value to kN, kN·m, mm, MPa", () => {
    const eu = convertFormToCode(EXAMPLE_FORM_ACI, "EN 1992-1-1");
    expect(eu.code).toBe("EN 1992-1-1");
    expect(Number(eu.Vu)).toBeCloseTo(297 * 4.4482216152605, 0);
    expect(Number(eu.Mux)).toBeCloseTo(83.7 * 1.3558179483314, 0);
    expect(Number(eu.c1)).toBeCloseTo(304.8, 1);
    expect(Number(eu.c2)).toBeCloseTo(508, 1);
    expect(Number(eu.d)).toBeCloseTo(406.4, 1);
    expect(Number(eu.fc)).toBeCloseTo(34.5, 1); // 5000 psi
    expect(Number(eu.openings[0]!.x)).toBeCloseTo(-1193.8, 1);
    expect(Number(eu.openings[0]!.diameter)).toBeCloseTo(76.2, 1);
  });

  it("EU → US → EU keeps the data (within rounding) and the engine result", () => {
    const back = convertFormToCode(
      convertFormToCode(EXAMPLE_FORM_EC2, "ACI 318-19"),
      "EN 1992-1-1",
    );
    for (const key of ["Vu", "Muy", "c1", "c2", "d", "h", "fc"] as const) {
      expect(Number(back[key])).toBeCloseTo(Number(EXAMPLE_FORM_EC2[key]), 0);
    }
    const a = runCalc(EXAMPLE_FORM_EC2);
    const b = runCalc(back);
    expect(a.outcome.ok && b.outcome.ok).toBe(true);
    if (a.outcome.ok && b.outcome.ok) expect(b.outcome.dcr).toBeCloseTo(a.outcome.dcr, 1);
  });

  it("keeps empty or non-numeric text untouched and non-dimensional fields as they are", () => {
    const messy = { ...EXAMPLE_FORM_ACI, Vu: "", d: "abc", lambda: "0.85", rhoX: "0.8" };
    const eu = convertFormToCode(messy, "EN 1992-1-1");
    expect(eu.Vu).toBe("");
    expect(eu.d).toBe("abc");
    expect(eu.lambda).toBe("0.85");
    expect(eu.rhoX).toBe("0.8");
    expect(convertFormToCode(eu, "EN 1992-1-1")).toBe(eu);
  });

  it("maps the form to the engine input of the selected code only", () => {
    const aci = toEngineInput(EXAMPLE_FORM_ACI);
    expect(aci.Vu).toBeCloseTo(297_000, 6);
    expect(aci.concrete.fc).toBe(5000);
    const ec2 = toEngineInputEC2(EXAMPLE_FORM_EC2);
    expect(ec2.VEd).toBeCloseTo(500_000, 6);
    expect(ec2.MEdy).toBeCloseTo(30_000_000, 3);
    expect(ec2.rhoLx).toBeCloseTo(0.01, 12);
    expect(ec2.fck).toBe(30);
  });

  it("only the selected engine runs and the example for each code is valid", () => {
    expect(runCalc(exampleFor("ACI 318-19")).code).toBe("ACI 318-19");
    const eu = runCalc(exampleFor("EN 1992-1-1"));
    expect(eu.code).toBe("EN 1992-1-1");
    expect(eu.outcome.ok).toBe(true);
  });
});
