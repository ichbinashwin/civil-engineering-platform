import { ACI318_19 } from "../codes/aci318-19";

const { twoWayShear: TWS, sizeEffect: SE } = ACI318_19;

/** lambda_s = sqrt(2 / (1 + d/10)) <= 1.0 with d in inches, ACI 318-19 §22.5.5.1.3. */
export function sizeEffectFactor(d: number): number {
  return Math.min(SE.maximum, Math.sqrt(SE.numerator / (1 + d / SE.referenceDepthIn)));
}

export interface ConcreteCapacity {
  sqrtFc: number;
  sqrtFcLimited: boolean;
  betaC: number;
  alphaS: number;
  vcA: number;
  vcB: number;
  vcC: number;
  governingVc: number;
  governingEquation: "a" | "b" | "c";
}

/**
 * Two-way shear stress capacity vc (psi) without shear reinforcement, ACI 318-19 Table 22.6.5.2:
 *   (a) 4 lambda_s lambda sqrt(f'c)
 *   (b) (2 + 4/beta) lambda_s lambda sqrt(f'c)
 *   (c) (2 + alpha_s d / bo) lambda_s lambda sqrt(f'c)
 * sqrt(f'c) limited to 100 psi per §22.6.3.1.
 */
export function concreteCapacity(params: {
  fc: number;
  lambda: number;
  lambdaS: number;
  c1: number;
  c2: number;
  d: number;
  bo: number;
  columnLocation: keyof typeof TWS.alphaS;
}): ConcreteCapacity {
  const rawSqrtFc = Math.sqrt(params.fc);
  const sqrtFc = Math.min(rawSqrtFc, TWS.sqrtFcLimitPsi);
  const betaC = Math.max(params.c1, params.c2) / Math.min(params.c1, params.c2);
  const alphaS = TWS.alphaS[params.columnLocation];
  const base = params.lambdaS * params.lambda * sqrtFc;

  const vcA = TWS.vcCoefficientA * base;
  const vcB = (TWS.vcCoefficientBConstant + TWS.vcCoefficientBBeta / betaC) * base;
  const vcC = (TWS.vcCoefficientCConstant + (alphaS * params.d) / params.bo) * base;

  const candidates = [
    ["a", vcA],
    ["b", vcB],
    ["c", vcC],
  ] as const;
  const [governingEquation, governingVc] = candidates.reduce((min, c) => (c[1] < min[1] ? c : min));

  return {
    sqrtFc,
    sqrtFcLimited: rawSqrtFc > TWS.sqrtFcLimitPsi,
    betaC,
    alphaS,
    vcA,
    vcB,
    vcC,
    governingVc,
    governingEquation,
  };
}
