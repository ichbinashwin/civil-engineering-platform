import { GEOMETRY_TOLERANCE } from "./rectangular-perimeter";
import type { Point } from "./rectangular-perimeter";
import type { AngularSpan, PerimeterInterval } from "./opening-shadow";

/**
 * Basic control perimeter of EN 1992-1-1 §6.4.2(1) / Figure 6.13 around a rectangular loaded area:
 * straight runs parallel to the column faces at distance `radius` (= 2.0 d), joined by quarter circles
 * of that radius. Parameterized by arc length s counter-clockwise from the start of the bottom run.
 */
export interface LinePiece {
  kind: "line";
  start: Point;
  end: Point;
  length: number;
}

/** Counter-clockwise arc, startAngle < endAngle (rad). */
export interface ArcPiece {
  kind: "arc";
  center: Point;
  radius: number;
  startAngle: number;
  endAngle: number;
  length: number;
}

export type PerimeterPiece = LinePiece | ArcPiece;
type Primitive = PerimeterPiece & { s0: number };

export interface RoundedPerimeter {
  halfX: number;
  halfY: number;
  radius: number;
  length: number;
  primitives: Primitive[];
}

const QUARTER = Math.PI / 2;
/** Numerical integration step on arcs (rad); integrand error is O(step²) ≈ 1e-6 relative. */
const ARC_INTEGRATION_STEP = 0.002;
/** Drawing resolution of arcs (rad), 5°. */
const ARC_DRAW_STEP = Math.PI / 36;

export function createRoundedPerimeter(
  columnX: number,
  columnY: number,
  radius: number,
): RoundedPerimeter {
  const hx = columnX / 2;
  const hy = columnY / 2;
  const r = radius;
  const line = (start: Point, end: Point): LinePiece => ({
    kind: "line",
    start,
    end,
    length: Math.hypot(end.x - start.x, end.y - start.y),
  });
  const arc = (center: Point, startAngle: number): ArcPiece => ({
    kind: "arc",
    center,
    radius: r,
    startAngle,
    endAngle: startAngle + QUARTER,
    length: r * QUARTER,
  });
  const pieces: PerimeterPiece[] = [
    line({ x: -hx, y: -hy - r }, { x: hx, y: -hy - r }),
    arc({ x: hx, y: -hy }, -QUARTER),
    line({ x: hx + r, y: -hy }, { x: hx + r, y: hy }),
    arc({ x: hx, y: hy }, 0),
    line({ x: hx, y: hy + r }, { x: -hx, y: hy + r }),
    arc({ x: -hx, y: hy }, QUARTER),
    line({ x: -hx - r, y: hy }, { x: -hx - r, y: -hy }),
    arc({ x: -hx, y: -hy }, Math.PI),
  ];
  let s = 0;
  const primitives = pieces.map((p) => {
    const withStart = { ...p, s0: s } as Primitive;
    s += p.length;
    return withStart;
  });
  return { halfX: hx, halfY: hy, radius: r, length: s, primitives };
}

/** Distance from the centre along a ray (unit vector ux, uy) to the control perimeter. */
function rayDistance(p: RoundedPerimeter, ux: number, uy: number): number {
  const ax = Math.abs(ux);
  const ay = Math.abs(uy);
  if (ax > GEOMETRY_TOLERANCE) {
    const t = (p.halfX + p.radius) / ax;
    if (ay * t <= p.halfY + GEOMETRY_TOLERANCE) return t;
  }
  if (ay > GEOMETRY_TOLERANCE) {
    const t = (p.halfY + p.radius) / ay;
    if (ax * t <= p.halfX + GEOMETRY_TOLERANCE) return t;
  }
  // Corner arc about (halfX, halfY) in the first quadrant (symmetry): |t u - C| = r, outer root.
  const uc = ax * p.halfX + ay * p.halfY;
  const cc = p.halfX * p.halfX + p.halfY * p.halfY;
  return uc + Math.sqrt(Math.max(uc * uc - cc + p.radius * p.radius, 0));
}

/** Arc-length coordinate of a point lying on the perimeter. */
function arcLengthOf(p: RoundedPerimeter, point: Point): number {
  const { halfX: hx, halfY: hy, radius: r, primitives: prim } = p;
  const start = (i: number) => (prim[i] as Primitive).s0;
  const { x, y } = point;
  if (x > hx && y < -hy) return start(1) + r * (Math.atan2(y + hy, x - hx) + QUARTER);
  if (x > hx && y > hy) return start(3) + r * Math.atan2(y - hy, x - hx);
  if (x < -hx && y > hy) return start(5) + r * (Math.atan2(y - hy, x + hx) - QUARTER);
  if (x < -hx && y < -hy) {
    let phi = Math.atan2(y + hy, x + hx);
    if (phi < 0) phi += 2 * Math.PI;
    return start(7) + r * (phi - Math.PI);
  }
  if (Math.abs(x) <= hx) return y < 0 ? start(0) + (x + hx) : start(4) + (hx - x);
  return x > 0 ? start(2) + (y + hy) : start(6) + (hy - y);
}

/** Perimeter point reached by the ray from the loaded-area centre at angle theta. */
export function perimeterPointAtAngle(p: RoundedPerimeter, theta: number): Point {
  const ux = Math.cos(theta);
  const uy = Math.sin(theta);
  const t = rayDistance(p, ux, uy);
  return { x: ux * t, y: uy * t };
}

/** Ineffective arc-length intervals for an opening's tangent span (EN 1992-1-1 §6.4.2(3)). */
export function roundedShadowIntervals(
  p: RoundedPerimeter,
  span: AngularSpan,
): PerimeterInterval[] {
  const s1 = arcLengthOf(p, perimeterPointAtAngle(p, span.from));
  const s2 = arcLengthOf(p, perimeterPointAtAngle(p, span.to));
  if (s2 >= s1) return [{ start: s1, end: s2 }];
  return [
    { start: s1, end: p.length },
    { start: 0, end: s2 },
  ];
}

function slicePiece(prim: Primitive, from: number, to: number): PerimeterPiece {
  if (prim.kind === "line") {
    const t0 = from / prim.length;
    const t1 = to / prim.length;
    const lerp = (t: number): Point => ({
      x: prim.start.x + (prim.end.x - prim.start.x) * t,
      y: prim.start.y + (prim.end.y - prim.start.y) * t,
    });
    return { kind: "line", start: lerp(t0), end: lerp(t1), length: to - from };
  }
  return {
    kind: "arc",
    center: prim.center,
    radius: prim.radius,
    startAngle: prim.startAngle + from / prim.radius,
    endAngle: prim.startAngle + to / prim.radius,
    length: to - from,
  };
}

/** Straight and curved pieces of the perimeter between two arc-length positions (from <= to). */
export function roundedPiecesBetween(
  p: RoundedPerimeter,
  from: number,
  to: number,
): PerimeterPiece[] {
  const out: PerimeterPiece[] = [];
  for (const prim of p.primitives) {
    const a = Math.max(from, prim.s0);
    const b = Math.min(to, prim.s0 + prim.length);
    if (b - a > GEOMETRY_TOLERANCE) out.push(slicePiece(prim, a - prim.s0, b - prim.s0));
  }
  return out;
}

/** Pieces remaining after removing (merged, sorted, non-overlapping) ineffective intervals. */
export function roundedEffectivePieces(
  p: RoundedPerimeter,
  mergedRemoved: PerimeterInterval[],
): PerimeterPiece[] {
  const out: PerimeterPiece[] = [];
  let cursor = 0;
  for (const interval of mergedRemoved) {
    out.push(...roundedPiecesBetween(p, cursor, interval.start));
    cursor = Math.max(cursor, interval.end);
  }
  out.push(...roundedPiecesBetween(p, cursor, p.length));
  return out;
}

/** Polyline approximation of a piece (arcs sampled every 5°). */
export function pieceToPoints(piece: PerimeterPiece): Point[] {
  if (piece.kind === "line") return [piece.start, piece.end];
  const sweep = piece.endAngle - piece.startAngle;
  const steps = Math.max(2, Math.ceil(sweep / ARC_DRAW_STEP));
  return Array.from({ length: steps + 1 }, (_, i) => {
    const a = piece.startAngle + (sweep * i) / steps;
    return {
      x: piece.center.x + piece.radius * Math.cos(a),
      y: piece.center.y + piece.radius * Math.sin(a),
    };
  });
}

/** Closed outline of the whole perimeter for drawing. */
export function roundedOutline(p: RoundedPerimeter): Point[] {
  return roundedPiecesBetween(p, 0, p.length).flatMap((piece, i) => {
    const pts = pieceToPoints(piece);
    return i === 0 ? pts : pts.slice(1);
  });
}

export interface RoundedProperties {
  length: number;
  centroidX: number;
  centroidY: number;
  /** ∫|y − ȳ| dl : W1 for a moment about the X axis. */
  absMomentAboutX: number;
  /** ∫|x − x̄| dl : W1 for a moment about the Y axis. */
  absMomentAboutY: number;
}

/** ∫|a + b t| over t in [0, 1] for a line of the given length (exact). */
function lineAbsIntegral(f0: number, f1: number, length: number): number {
  if (f0 * f1 >= 0) return (length * (Math.abs(f0) + Math.abs(f1))) / 2;
  return (length * (f0 * f0 + f1 * f1)) / (2 * (Math.abs(f0) + Math.abs(f1)));
}

/** Midpoint-rule ∫ g(angle) r dangle over the arc. */
function arcIntegral(piece: ArcPiece, g: (x: number, y: number) => number): number {
  const sweep = piece.endAngle - piece.startAngle;
  const steps = Math.max(8, Math.ceil(sweep / ARC_INTEGRATION_STEP));
  const da = sweep / steps;
  let sum = 0;
  for (let i = 0; i < steps; i++) {
    const a = piece.startAngle + (i + 0.5) * da;
    sum += g(
      piece.center.x + piece.radius * Math.cos(a),
      piece.center.y + piece.radius * Math.sin(a),
    );
  }
  return sum * da * piece.radius;
}

/** Length, centroid and the absolute first moments W1 about the centroidal X and Y axes. */
export function roundedProperties(pieces: PerimeterPiece[]): RoundedProperties {
  let length = 0;
  let sx = 0;
  let sy = 0;
  for (const piece of pieces) {
    length += piece.length;
    if (piece.kind === "line") {
      sx += (piece.length * (piece.start.x + piece.end.x)) / 2;
      sy += (piece.length * (piece.start.y + piece.end.y)) / 2;
    } else {
      const d = piece.endAngle - piece.startAngle;
      const r = piece.radius;
      sx +=
        r * piece.center.x * d + r * r * (Math.sin(piece.endAngle) - Math.sin(piece.startAngle));
      sy +=
        r * piece.center.y * d - r * r * (Math.cos(piece.endAngle) - Math.cos(piece.startAngle));
    }
  }
  const centroidX = sx / length;
  const centroidY = sy / length;

  let absY = 0;
  let absX = 0;
  for (const piece of pieces) {
    if (piece.kind === "line") {
      absY += lineAbsIntegral(piece.start.y - centroidY, piece.end.y - centroidY, piece.length);
      absX += lineAbsIntegral(piece.start.x - centroidX, piece.end.x - centroidX, piece.length);
    } else {
      absY += arcIntegral(piece, (_x, y) => Math.abs(y - centroidY));
      absX += arcIntegral(piece, (x) => Math.abs(x - centroidX));
    }
  }
  return { length, centroidX, centroidY, absMomentAboutX: absY, absMomentAboutY: absX };
}
