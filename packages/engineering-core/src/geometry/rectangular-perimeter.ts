/**
 * Rectangular closed perimeter centered at the origin, parameterized by arc length s
 * measured counter-clockwise from the corner (-halfX, -halfY).
 */
export interface Point {
  x: number;
  y: number;
}

export interface Segment {
  start: Point;
  end: Point;
  length: number;
}

export interface RectangularPerimeter {
  halfX: number;
  halfY: number;
  length: number;
}

/** Tolerance for geometric coincidence (in). */
export const GEOMETRY_TOLERANCE = 1e-9;

export function createRectangularPerimeter(sizeX: number, sizeY: number): RectangularPerimeter {
  return { halfX: sizeX / 2, halfY: sizeY / 2, length: 2 * (sizeX + sizeY) };
}

function corners(p: RectangularPerimeter): Point[] {
  return [
    { x: -p.halfX, y: -p.halfY },
    { x: p.halfX, y: -p.halfY },
    { x: p.halfX, y: p.halfY },
    { x: -p.halfX, y: p.halfY },
  ];
}

/** Arc-length positions of the four corners, starting at s = 0. */
export function cornerPositions(p: RectangularPerimeter): number[] {
  const sizeX = 2 * p.halfX;
  const sizeY = 2 * p.halfY;
  return [0, sizeX, sizeX + sizeY, 2 * sizeX + sizeY];
}

export function pointAt(p: RectangularPerimeter, s: number): Point {
  const wrapped = ((s % p.length) + p.length) % p.length;
  const pts = corners(p);
  const starts = cornerPositions(p);
  for (let i = 3; i >= 0; i--) {
    const start = starts[i] as number;
    if (wrapped >= start) {
      const a = pts[i] as Point;
      const b = pts[(i + 1) % 4] as Point;
      const sideLength = Math.hypot(b.x - a.x, b.y - a.y);
      const t = (wrapped - start) / sideLength;
      return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    }
  }
  return pts[0] as Point;
}

/** Arc-length position where a ray from the origin at angle theta (rad) meets the perimeter. */
export function rayIntersection(p: RectangularPerimeter, theta: number): number {
  const dx = Math.cos(theta);
  const dy = Math.sin(theta);
  const tX = Math.abs(dx) > GEOMETRY_TOLERANCE ? p.halfX / Math.abs(dx) : Number.POSITIVE_INFINITY;
  const tY = Math.abs(dy) > GEOMETRY_TOLERANCE ? p.halfY / Math.abs(dy) : Number.POSITIVE_INFINITY;
  const t = Math.min(tX, tY);
  const x = dx * t;
  const y = dy * t;
  const sizeX = 2 * p.halfX;
  const sizeY = 2 * p.halfY;

  if (tY <= tX) {
    // Hits a horizontal side.
    return y < 0 ? x + p.halfX : sizeX + sizeY + (p.halfX - x);
  }
  // Hits a vertical side.
  return x > 0 ? sizeX + (y + p.halfY) : 2 * sizeX + sizeY + (p.halfY - y);
}

/** Splits the perimeter at the given arc-length cuts, returning straight segments. */
export function segmentsBetween(p: RectangularPerimeter, from: number, to: number): Segment[] {
  const cuts = [from, ...cornerPositions(p).filter((c) => c > from && c < to), to];
  const segments: Segment[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i] as number;
    const b = cuts[i + 1] as number;
    if (b - a > GEOMETRY_TOLERANCE) {
      segments.push({ start: pointAt(p, a), end: pointAt(p, b), length: b - a });
    }
  }
  return segments;
}
