import type { Opening } from "@civil/shared-types";
import { GEOMETRY_TOLERANCE, rayIntersection, segmentsBetween } from "./rectangular-perimeter";
import type { Point, RectangularPerimeter, Segment } from "./rectangular-perimeter";

/** Closed arc-length interval [start, end] on the perimeter, start <= end, no wrap. */
export interface PerimeterInterval {
  start: number;
  end: number;
}

export interface AngularSpan {
  /** Lower tangent angle (rad). */
  from: number;
  /** Upper tangent angle (rad); from < to, to - from < PI. */
  to: number;
}

function normalizeAngle(angle: number): number {
  let a = angle;
  while (a <= -Math.PI) a += 2 * Math.PI;
  while (a > Math.PI) a -= 2 * Math.PI;
  return a;
}

/**
 * Angular span subtended at the origin (column centroid) by the opening, bounded by the
 * straight tangent lines of ACI 318-19 §22.6.4.3. Returns null if the origin lies inside
 * the opening (no tangent solution exists).
 */
export function openingAngularSpan(opening: Opening): AngularSpan | null {
  const center = Math.atan2(opening.centerY, opening.centerX);

  if (opening.type === "circle") {
    const distance = Math.hypot(opening.centerX, opening.centerY);
    const radius = opening.diameter / 2;
    if (distance <= radius + GEOMETRY_TOLERANCE) return null;
    const halfAngle = Math.asin(radius / distance);
    return { from: center - halfAngle, to: center + halfAngle };
  }

  const hw = opening.width / 2;
  const hh = opening.height / 2;
  if (
    Math.abs(opening.centerX) <= hw + GEOMETRY_TOLERANCE &&
    Math.abs(opening.centerY) <= hh + GEOMETRY_TOLERANCE
  ) {
    return null;
  }
  const offsets = [
    [-hw, -hh],
    [hw, -hh],
    [hw, hh],
    [-hw, hh],
  ].map(([dx, dy]) =>
    normalizeAngle(
      Math.atan2(opening.centerY + (dy as number), opening.centerX + (dx as number)) - center,
    ),
  );
  return { from: center + Math.min(...offsets), to: center + Math.max(...offsets) };
}

/** Maps an angular span onto the perimeter as one or two non-wrapping intervals. */
export function shadowIntervals(p: RectangularPerimeter, span: AngularSpan): PerimeterInterval[] {
  const s1 = rayIntersection(p, span.from);
  const s2 = rayIntersection(p, span.to);
  if (s2 >= s1) return [{ start: s1, end: s2 }];
  return [
    { start: s1, end: p.length },
    { start: 0, end: s2 },
  ];
}

export function intervalLength(intervals: PerimeterInterval[]): number {
  return intervals.reduce((sum, i) => sum + (i.end - i.start), 0);
}

/** Union of possibly-overlapping intervals (overlapping opening shadows are not double-counted). */
export function mergeIntervals(intervals: PerimeterInterval[]): PerimeterInterval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start);
  const merged: PerimeterInterval[] = [];
  for (const interval of sorted) {
    const last = merged[merged.length - 1];
    if (last && interval.start <= last.end + GEOMETRY_TOLERANCE) {
      last.end = Math.max(last.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }
  return merged;
}

/** Effective (remaining) perimeter segments after removing ineffective intervals. */
export function effectiveSegments(
  p: RectangularPerimeter,
  removed: PerimeterInterval[],
): Segment[] {
  const merged = mergeIntervals(removed);
  const segments: Segment[] = [];
  let cursor = 0;
  for (const interval of merged) {
    segments.push(...segmentsBetween(p, cursor, interval.start));
    cursor = Math.max(cursor, interval.end);
  }
  segments.push(...segmentsBetween(p, cursor, p.length));
  return segments;
}

/** Shortest clear distance between an opening edge and a centered rectangle (0 if touching/overlapping). */
export function openingDistanceToRectangle(opening: Opening, halfX: number, halfY: number): number {
  if (opening.type === "circle") {
    const gapX = Math.max(0, Math.abs(opening.centerX) - halfX);
    const gapY = Math.max(0, Math.abs(opening.centerY) - halfY);
    return Math.max(0, Math.hypot(gapX, gapY) - opening.diameter / 2);
  }
  const gapX = Math.max(0, Math.abs(opening.centerX) - halfX - opening.width / 2);
  const gapY = Math.max(0, Math.abs(opening.centerY) - halfY - opening.height / 2);
  return Math.hypot(gapX, gapY);
}

/** True when any part of the opening lies inside the centered rectangle. */
export function openingOverlapsRectangle(opening: Opening, halfX: number, halfY: number): boolean {
  if (opening.type === "rectangle") {
    return (
      Math.abs(opening.centerX) < halfX + opening.width / 2 &&
      Math.abs(opening.centerY) < halfY + opening.height / 2
    );
  }
  const nearest: Point = {
    x: Math.min(Math.max(opening.centerX, -halfX), halfX),
    y: Math.min(Math.max(opening.centerY, -halfY), halfY),
  };
  return (
    Math.hypot(opening.centerX - nearest.x, opening.centerY - nearest.y) < opening.diameter / 2
  );
}

/** True when the opening boundary crosses the rectangular perimeter line. */
export function openingCrossesPerimeter(opening: Opening, p: RectangularPerimeter): boolean {
  const overlapsOuter = openingOverlapsRectangle(opening, p.halfX, p.halfY);
  if (!overlapsOuter) return false;
  // Fully inside the perimeter does not cross the line.
  if (opening.type === "circle") {
    const r = opening.diameter / 2;
    return !(Math.abs(opening.centerX) + r < p.halfX && Math.abs(opening.centerY) + r < p.halfY);
  }
  return !(
    Math.abs(opening.centerX) + opening.width / 2 < p.halfX &&
    Math.abs(opening.centerY) + opening.height / 2 < p.halfY
  );
}
