import { ACI318_19 } from "../codes/aci318-19";

/**
 * gamma_v = 1 - gamma_f, gamma_f = 1 / (1 + (2/3) sqrt(b1 / b2)), ACI 318-19 §8.4.2.2.2 and §8.4.4.2.2.
 * b1: critical-section dimension in the span direction for which moments are determined.
 * b2: critical-section dimension perpendicular to b1.
 */
export function momentTransferFractionShear(b1: number, b2: number): number {
  const gammaF = 1 / (1 + ACI318_19.momentTransfer.gammaFCoefficient * Math.sqrt(b1 / b2));
  return 1 - gammaF;
}
