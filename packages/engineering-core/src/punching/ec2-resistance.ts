import { EN1992_1_1 } from "../codes/en1992-1-1";

const P = EN1992_1_1.punching;

/** k = 1 + sqrt(200/d) <= 2.0, d in mm (§6.4.4(1)). */
export function sizeFactorK(dMm: number): number {
  return Math.min(P.sizeFactorMax, 1 + Math.sqrt(P.sizeFactorNumerator / dMm));
}

/** ρl = sqrt(ρly ρlz) <= 0.02 (§6.4.4(1)). */
export function reinforcementRatioRhoL(rhoLx: number, rhoLy: number): number {
  return Math.min(P.rhoMax, Math.sqrt(rhoLx * rhoLy));
}

/** vmin = 0.035 k^(3/2) fck^(1/2), MPa (6.3N). */
export function minimumResistanceVmin(k: number, fck: number): number {
  return P.vMinCoefficient * k ** P.vMinKExponent * Math.sqrt(fck);
}

export interface Resistance {
  k: number;
  rhoL: number;
  cRdc: number;
  vRdcFormula: number;
  vMin: number;
  vRdc: number;
  governingExpression: "6.47" | "6.3N";
}

/**
 * vRd,c = max[ CRd,c k (100 ρl fck)^(1/3), vmin ] (MPa), σcp = 0 (6.47); CRd,c = 0.18/γc.
 * Axial stress σcp is not supported (k1 σcp term omitted).
 */
export function resistanceWithoutReinforcement(params: {
  fck: number;
  dMm: number;
  rhoLx: number;
  rhoLy: number;
  gammaC: number;
}): Resistance {
  const k = sizeFactorK(params.dMm);
  const rhoL = reinforcementRatioRhoL(params.rhoLx, params.rhoLy);
  const cRdc = P.cRdcNumerator / params.gammaC;
  const vRdcFormula = cRdc * k * (100 * rhoL * params.fck) ** (1 / 3);
  const vMin = minimumResistanceVmin(k, params.fck);
  return {
    k,
    rhoL,
    cRdc,
    vRdcFormula,
    vMin,
    vRdc: Math.max(vRdcFormula, vMin),
    governingExpression: vRdcFormula >= vMin ? "6.47" : "6.3N",
  };
}

/** ν = 0.6 [1 − fck/250] (6.6N). */
export function strengthReductionNu(fck: number): number {
  return P.nuCoefficient * (1 - fck / P.nuFckDivisor);
}

/** fcd = αcc fck / γc (3.15). */
export function designCompressiveStrength(fck: number, alphaCc: number, gammaC: number): number {
  return (alphaCc * fck) / gammaC;
}

/** vRd,max = 0.4 ν fcd (6.53 note), MPa. */
export function maximumResistance(fck: number, alphaCc: number, gammaC: number): number {
  return (
    P.vRdMaxCoefficient * strengthReductionNu(fck) * designCompressiveStrength(fck, alphaCc, gammaC)
  );
}
