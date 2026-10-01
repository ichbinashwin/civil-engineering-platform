import { EN1992_1_1 } from "../codes/en1992-1-1";

const P = EN1992_1_1.punching;

/**
 * k from Table 6.1 for the ratio c1/c2 (c1 parallel to the eccentricity). The table lists discrete rows
 * (≤0.5, 1.0, 2.0, ≥3.0); linear interpolation between rows is a software choice, documented.
 */
export function betaKCoefficient(cParallel: number, cPerpendicular: number): number {
  const ratio = cParallel / cPerpendicular;
  const table = P.betaKTable;
  const first = table[0];
  const last = table[table.length - 1];
  if (!first || !last) throw new Error("Table 6.1 is empty");
  if (ratio <= first.ratio) return first.k;
  if (ratio >= last.ratio) return last.k;
  for (let i = 1; i < table.length; i++) {
    const hi = table[i];
    const lo = table[i - 1];
    if (hi && lo && ratio <= hi.ratio) {
      return lo.k + ((hi.k - lo.k) * (ratio - lo.ratio)) / (hi.ratio - lo.ratio);
    }
  }
  return last.k;
}

/**
 * W1 for a complete rectangular basic control perimeter, EN 1992-1-1 (6.40):
 * W1 = c1²/2 + c1 c2 + 4 c2 d + 16 d² + 2π d c1, with c1 parallel and c2 perpendicular to the eccentricity.
 */
export function w1Rectangular(cParallel: number, cPerpendicular: number, d: number): number {
  return (
    (cParallel * cParallel) / 2 +
    cParallel * cPerpendicular +
    P.controlPerimeterFactor * 2 * cPerpendicular * d +
    4 * P.controlPerimeterFactor * P.controlPerimeterFactor * d * d +
    P.controlPerimeterFactor * Math.PI * d * cParallel
  );
}

/** β = 1 + k (MEd/VEd)(u1/W1), expression (6.39), eccentricity about one axis. */
export function betaUniaxial(
  k: number,
  moment: number,
  shear: number,
  u1: number,
  w1: number,
): number {
  return 1 + k * (Math.abs(moment) / shear) * (u1 / w1);
}

/**
 * β = 1 + 1.8 sqrt[(ey/bz)² + (ez/by)²], expression (6.43), eccentricity about both axes.
 * ey, ez: MEd/VEd along the y and z axes; by, bz: control perimeter dimensions along y and z.
 */
export function betaBiaxial(ey: number, ez: number, by: number, bz: number): number {
  return 1 + P.biaxialBetaCoefficient * Math.sqrt((ey / bz) ** 2 + (ez / by) ** 2);
}
