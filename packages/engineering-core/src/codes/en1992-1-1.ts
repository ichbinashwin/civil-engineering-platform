import type { CodeReference } from "@civil/shared-types";

/**
 * EN 1992-1-1 (Eurocode 2) constants for two-way punching shear, 6.4. Recommended values; a National
 * Annex may change γc, αcc, CRd,c, vmin, k1 and the νRd,max coefficient. Every constant cites its clause.
 */
export const EN1992_1_1 = {
  code: "EN 1992-1-1",
  edition: "2004",
  punching: {
    /** §6.4.2(1): basic control perimeter at 2.0 d from the loaded area. */
    controlPerimeterFactor: 2,
    /** §6.4.2(3): openings within 6 d of the loaded area reduce the control perimeter. */
    openingInfluenceFactor: 6,
    /** §6.4.4(1): reinforcement ratio averaged over the column width plus 3 d each side. */
    reinforcementWidthFactor: 3,
    /** Table 2.1N: partial factor for concrete, persistent and transient situations. */
    gammaC: 1.5,
    /** §3.1.6(1)P: recommended αcc. */
    alphaCc: 1,
    /** §6.4.4(1): recommended CRd,c = 0.18 / γc. */
    cRdcNumerator: 0.18,
    /** §6.4.4(1): k = 1 + sqrt(200/d) <= 2.0, d in mm. */
    sizeFactorNumerator: 200,
    sizeFactorMax: 2,
    /** §6.4.4(1): ρl = sqrt(ρly ρlz) <= 0.02. */
    rhoMax: 0.02,
    /** §6.4.4(1), expression (6.3N): vmin = 0.035 k^(3/2) fck^(1/2). */
    vMinCoefficient: 0.035,
    vMinKExponent: 1.5,
    /** §6.2.2(6), expression (6.6N): ν = 0.6 [1 − fck/250]. */
    nuCoefficient: 0.6,
    nuFckDivisor: 250,
    /** §6.4.5(3) note: recommended vRd,max = 0.4 ν fcd. */
    vRdMaxCoefficient: 0.4,
    /** §6.4.3(3), expression (6.43): coefficient of the approximate biaxial β. */
    biaxialBetaCoefficient: 1.8,
    /** Table 6.1: k versus c1/c2 (c1 parallel to the eccentricity); linear interpolation between rows. */
    betaKTable: [
      { ratio: 0.5, k: 0.45 },
      { ratio: 1, k: 0.6 },
      { ratio: 2, k: 0.7 },
      { ratio: 3, k: 0.8 },
    ],
    /** Table 3.1: concrete strength classes C12/15 … C90/105. */
    fckMin: 12,
    fckMax: 90,
  },
} as const;

function ref(section: string, description: string): CodeReference {
  return {
    code: EN1992_1_1.code,
    edition: EN1992_1_1.edition,
    section,
    description,
  };
}

export const EN1992_1_1_REFS = {
  controlPerimeter: ref("6.4.2(1)", "Basic control perimeter u1 at 2.0d from the loaded area"),
  openings: ref(
    "6.4.2(3)",
    "Openings within 6d: part of the control perimeter between tangents from the loaded-area centre is ineffective",
  ),
  checks: ref(
    "6.4.3(2)",
    "Checks at the column perimeter (vRd,max) and at the basic control perimeter (vRd,c)",
  ),
  beta: ref(
    "6.4.3(3), (6.38)–(6.40)",
    "Eccentric loading: vEd = β VEd/(ui d), β = 1 + k (MEd/VEd)(u1/W1)",
  ),
  kTable: ref("Table 6.1", "Coefficient k for rectangular loaded areas"),
  w1: ref("(6.40)", "W1 = ∫|e| dl; closed form for a rectangular internal column"),
  betaBiaxial: ref(
    "6.4.3(3), (6.43)",
    "Approximate β for an internal rectangular column eccentric in both axes",
  ),
  resistance: ref(
    "6.4.4(1), (6.47)",
    "Punching shear resistance without shear reinforcement vRd,c",
  ),
  vMin: ref("6.4.4(1), (6.3N)", "Minimum resistance vmin = 0.035 k^(3/2) fck^(1/2)"),
  maxResistance: ref(
    "6.4.5(3), (6.53), (6.6N)",
    "Maximum punching shear resistance at the column perimeter vRd,max = 0.4 ν fcd",
  ),
  fcd: ref("3.1.6(1)P, (3.15)", "Design compressive strength fcd = αcc fck / γc"),
  gammaC: ref("Table 2.1N", "Partial factor for concrete γc = 1.5 (persistent and transient)"),
} as const;
