/**
 * Unit systems. Engine values are stored in the canonical system (US customary):
 * force lb, length in, moment lb-in, stress psi.
 */
export type UnitSystem = "US" | "SI";

export type ForceUnit = "lb" | "kip" | "N" | "kN";
export type LengthUnit = "in" | "ft" | "mm" | "m";
export type MomentUnit = "lb-in" | "kip-in" | "kip-ft" | "N-mm" | "kN-m";
export type StressUnit = "psi" | "ksi" | "MPa";
