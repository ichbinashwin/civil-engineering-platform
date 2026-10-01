/** Display formatting only. No engineering logic belongs in apps/web. */
export function formatNumber(value: number, digits = 2): string {
  if (!Number.isFinite(value)) return "—";
  return value.toLocaleString("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

/**
 * Utilization color for visualization (stress / design strength). Display only; PASS/FAIL is
 * always also stated in text.
 */
export function utilizationColor(ratio: number): string {
  if (!Number.isFinite(ratio)) return "#66727f";
  if (ratio <= 0.7) return "#16805b";
  if (ratio <= 0.9) return "#5f8f2f";
  if (ratio <= 1.0) return "#b7791f";
  return "#b42318";
}

/** Continuous green → amber → red ramp for 3D vertex colors. Returns [r, g, b] in 0..1. */
export function utilizationRgb(ratio: number): [number, number, number] {
  const t = Math.min(Math.max(ratio, 0), 1.2) / 1.2;
  const green: [number, number, number] = [0.086, 0.502, 0.357];
  const amber: [number, number, number] = [0.718, 0.475, 0.122];
  const red: [number, number, number] = [0.706, 0.137, 0.094];
  const mix = (a: number[], b: number[], u: number) =>
    a.map((v, i) => v + ((b[i] ?? v) - v) * u) as [number, number, number];
  return t < 0.6 ? mix(green, amber, t / 0.6) : mix(amber, red, (t - 0.6) / 0.4);
}
