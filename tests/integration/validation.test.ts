import { describe, expect, it } from "vitest";
import { validatePunchingInput } from "@civil/engineering-validation";
import { referenceWith } from "../fixtures/punching-reference";

describe("engineering-aware validation", () => {
  it("reports d >= h as ERROR with field path", () => {
    const v = validatePunchingInput(referenceWith({ d: 20 }));
    expect(v.ok).toBe(false);
    expect(v.issues).toContainEqual(
      expect.objectContaining({ severity: "ERROR", code: "D_EXCEEDS_H", field: "d" }),
    );
  });

  it("reports low f'c as WARNING but allows calculation", () => {
    const v = validatePunchingInput(referenceWith({ concrete: { fc: 2000, lambda: 1 } }));
    expect(v.ok).toBe(true);
    expect(v.issues.some((i) => i.severity === "WARNING" && i.code === "LOW_FC")).toBe(true);
  });

  it("rejects lambda > 1", () => {
    expect(validatePunchingInput(referenceWith({ concrete: { fc: 4000, lambda: 1.2 } })).ok).toBe(
      false,
    );
  });
});
