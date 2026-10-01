import type { Segment } from "./rectangular-perimeter";

/**
 * Properties of a thin-walled critical section made of straight segments of depth d.
 *
 * Ix, Iy: line second moments about centroidal axes, sum of L/3 (a^2 + ab + b^2) (in^3).
 * Jx, Jy: "polar moment" analogues for moment transfer about X and Y (in^4), generalizing
 * the ACI 318-19 R8.4.4.2.3 interior-rectangle expression
 *   Jc = d b1^3/6 + b1 d^3/6 + d b2 b1^2/2
 * to an arbitrary set of segments:
 *   Jx = d * Ix + sum(L d^3 / 12 * uy^2),  Jy = d * Iy + sum(L d^3 / 12 * ux^2)
 * where (ux, uy) is the segment unit direction. For a full rectangle this reproduces Jc exactly.
 */
export interface CriticalSectionProperties {
  perimeter: number;
  centroidX: number;
  centroidY: number;
  Ix: number;
  Iy: number;
  Jx: number;
  Jy: number;
}

const TORSIONAL_TERM_DIVISOR = 12;

function lineSecondMoment(a: number, b: number, length: number): number {
  return (length / 3) * (a * a + a * b + b * b);
}

export function criticalSectionProperties(
  segments: Segment[],
  d: number,
): CriticalSectionProperties {
  const perimeter = segments.reduce((sum, s) => sum + s.length, 0);
  const centroidX =
    segments.reduce((sum, s) => sum + (s.length * (s.start.x + s.end.x)) / 2, 0) / perimeter;
  const centroidY =
    segments.reduce((sum, s) => sum + (s.length * (s.start.y + s.end.y)) / 2, 0) / perimeter;

  let Ix = 0;
  let Iy = 0;
  let torsionX = 0;
  let torsionY = 0;
  for (const s of segments) {
    Ix += lineSecondMoment(s.start.y - centroidY, s.end.y - centroidY, s.length);
    Iy += lineSecondMoment(s.start.x - centroidX, s.end.x - centroidX, s.length);
    const ux = (s.end.x - s.start.x) / s.length;
    const uy = (s.end.y - s.start.y) / s.length;
    const torsion = (s.length * d ** 3) / TORSIONAL_TERM_DIVISOR;
    torsionX += torsion * uy * uy;
    torsionY += torsion * ux * ux;
  }

  return {
    perimeter,
    centroidX,
    centroidY,
    Ix,
    Iy,
    Jx: d * Ix + torsionX,
    Jy: d * Iy + torsionY,
  };
}
