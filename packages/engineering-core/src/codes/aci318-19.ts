import type { CodeReference } from "@civil/shared-types";

/**
 * ACI 318-19 constants used by the engine. Every constant cites its provision.
 * Add other editions (318-14, 318-25) as sibling modules with the same shape.
 */
export const ACI318_19 = {
  code: "ACI 318",
  edition: "2019",
  twoWayShear: {
    /** Table 21.2.1(b): strength reduction factor for shear. */
    phiShear: 0.75,
    /** §22.6.3.1: limit on sqrt(f'c) used for two-way shear (psi). */
    sqrtFcLimitPsi: 100,
    /** §22.6.4.1: critical section located d/2 from column faces. */
    criticalSectionOffsetFactor: 0.5,
    /** §22.6.4.3: openings within this multiple of h from the column periphery reduce bo. */
    openingInfluenceHeightFactor: 4,
    /** Table 22.6.5.2: alpha_s by column location. */
    alphaS: { interior: 40, edge: 30, corner: 20 },
    /** Table 22.6.5.2 coefficients: vc = least of (a), (b), (c) times lambda_s * lambda * sqrt(f'c). */
    vcCoefficientA: 4,
    vcCoefficientBConstant: 2,
    vcCoefficientBBeta: 4,
    vcCoefficientCConstant: 2,
  },
  sizeEffect: {
    /** §22.5.5.1.3: lambda_s = sqrt(2 / (1 + d / 10)) <= 1.0, d in inches. */
    numerator: 2,
    referenceDepthIn: 10,
    maximum: 1,
  },
  momentTransfer: {
    /** §8.4.2.2.2: gamma_f = 1 / (1 + (2/3) sqrt(b1/b2)). */
    gammaFCoefficient: 2 / 3,
  },
} as const;

function ref(section: string, description: string): CodeReference {
  return { code: ACI318_19.code, edition: ACI318_19.edition, section, description };
}

export const ACI318_19_REFS = {
  momentTransferFraction: ref(
    "8.4.2.2",
    "Fraction of unbalanced moment transferred by flexure (gamma_f) and by eccentric shear (gamma_v = 1 - gamma_f)",
  ),
  shearStressFromMoment: ref(
    "8.4.4.2",
    "Factored two-way shear stress due to shear and moment transfer",
  ),
  phiShear: ref("21.2.1", "Strength reduction factor for shear, Table 21.2.1"),
  sizeEffect: ref("22.5.5.1.3", "Size effect modification factor lambda_s"),
  twoWayShear: ref("22.6", "Two-way shear strength"),
  sqrtFcLimit: ref("22.6.3.1", "Limit on sqrt(f'c) for two-way shear"),
  criticalSection: ref("22.6.4", "Critical sections for two-way members"),
  criticalSectionLocation: ref("22.6.4.1", "Critical section located d/2 from column faces"),
  openings: ref("22.6.4.3", "Ineffective portion of bo due to slab openings"),
  vcTable: ref("22.6.5.2", "Two-way shear strength without shear reinforcement, Table 22.6.5.2"),
} as const;
