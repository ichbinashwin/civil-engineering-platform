import type { ForceUnit, LengthUnit, MomentUnit, StressUnit } from "@civil/shared-types";

/**
 * Centralized unit conversion. Canonical engine units (US customary):
 * force lb, length in, moment lb-in, stress psi.
 * Each table maps a unit to its size expressed in the canonical unit.
 */
const LB_PER_N = 1 / 4.4482216152605;
const IN_PER_MM = 1 / 25.4;
/** 1 MPa = 1 N/mm^2. */
const PSI_PER_MPA = LB_PER_N / (IN_PER_MM * IN_PER_MM);

const FORCE_TO_LB: Record<ForceUnit, number> = {
  lb: 1,
  kip: 1000,
  N: LB_PER_N,
  kN: 1000 * LB_PER_N,
};

const LENGTH_TO_IN: Record<LengthUnit, number> = {
  in: 1,
  ft: 12,
  mm: IN_PER_MM,
  m: 1000 * IN_PER_MM,
};

const MOMENT_TO_LB_IN: Record<MomentUnit, number> = {
  "lb-in": 1,
  "kip-in": 1000,
  "kip-ft": 1000 * 12,
  "N-mm": LB_PER_N * IN_PER_MM,
  "kN-m": 1000 * LB_PER_N * 1000 * IN_PER_MM,
};

const STRESS_TO_PSI: Record<StressUnit, number> = {
  psi: 1,
  ksi: 1000,
  MPa: PSI_PER_MPA,
};

function convert<U extends string>(
  table: Record<U, number>,
  value: number,
  from: U,
  to: U,
): number {
  return (value * table[from]) / table[to];
}

export function convertForce(value: number, from: ForceUnit, to: ForceUnit): number {
  return convert(FORCE_TO_LB, value, from, to);
}

export function convertLength(value: number, from: LengthUnit, to: LengthUnit): number {
  return convert(LENGTH_TO_IN, value, from, to);
}

export function convertMoment(value: number, from: MomentUnit, to: MomentUnit): number {
  return convert(MOMENT_TO_LB_IN, value, from, to);
}

export function convertStress(value: number, from: StressUnit, to: StressUnit): number {
  return convert(STRESS_TO_PSI, value, from, to);
}
