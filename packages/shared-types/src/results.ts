import type { CodeReference } from "./codes";

export type WarningSeverity = "ERROR" | "WARNING" | "INFO";

export interface CalculationWarning {
  severity: WarningSeverity;
  code: string;
  message: string;
  field?: string;
  reference?: CodeReference;
}

/** One auditable step: formula, substituted values, result, unit, provision. */
export interface CalculationStep {
  id: string;
  title: string;
  formula: string;
  substitution: string;
  value: number;
  unit: string;
  reference?: CodeReference;
}

export type CalculationStatus = "PASS" | "FAIL" | "WARNING";

export interface SegmentDto {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface PunchingCriticalPoint {
  x: number;
  y: number;
  stress: number;
}

export interface PunchingShearResult {
  ok: true;
  status: CalculationStatus;
  demand: {
    directShear: number;
    momentX: number;
    momentY: number;
    maximumShearStress: number;
    gammaVx: number;
    gammaVy: number;
    criticalPoint: PunchingCriticalPoint;
    /** Stress sampled along each effective segment (visualization; same formula as the check). */
    stressProfile: PunchingCriticalPoint[][];
  };
  geometry: {
    /** Critical-section dimension along X: c1 + d (in). */
    sizeX: number;
    /** Critical-section dimension along Y: c2 + d (in). */
    sizeY: number;
    grossPerimeter: number;
    openingReductions: { openingIndex: number; reduction: number; applied: boolean }[];
    effectivePerimeter: number;
    centroidX: number;
    centroidY: number;
    Ix: number;
    Iy: number;
    Jx: number;
    Jy: number;
    /** Product of inertia of the effective section (line, in^3) and d·Ixy (in^4). Zero if symmetric. */
    Ixy: number;
    Jxy: number;
    segments: SegmentDto[];
    /** Tangent-line intersections with bo and the ineffective portion per opening (§22.6.4.3). */
    openingShadows: {
      openingIndex: number;
      tangentStart: { x: number; y: number };
      tangentEnd: { x: number; y: number };
      removedSegments: SegmentDto[];
    }[];
  };
  capacity: {
    lambda: number;
    lambdaS: number;
    sqrtFc: number;
    betaC: number;
    alphaS: number;
    vcA: number;
    vcB: number;
    vcC: number;
    governingVc: number;
    governingEquation: "a" | "b" | "c";
    phi: number;
    designStrength: number;
  };
  dcr: number;
  governingCheck: string;
  steps: CalculationStep[];
  codeReferences: CodeReference[];
  warnings: CalculationWarning[];
  meta: {
    module: string;
    designCode: string;
    engineVersion: string;
    method: string;
  };
}

/** Returned instead of a result when the calculation cannot be performed. Never a fake DCR. */
export interface CalculationUnavailable {
  ok: false;
  status: "UNAVAILABLE";
  reason: string;
  action: string;
  warnings: CalculationWarning[];
}

export type PunchingShearOutcome = PunchingShearResult | CalculationUnavailable;
