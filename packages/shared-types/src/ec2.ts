import type { CodeReference } from "./codes";
import type { ColumnGeometry, ColumnLocation, Opening, PunchingReinforcement } from "./domain";
import type {
  CalculationStatus,
  CalculationStep,
  CalculationUnavailable,
  CalculationWarning,
  PunchingCriticalPoint,
  SegmentDto,
} from "./results";

/**
 * Eurocode 2 (EN 1992-1-1:2004) two-way punching shear input in canonical SI units:
 * force N, moment N·mm, length mm, stress MPa. Axes as in the ACI model: origin at the column
 * centroid, c1 along X, c2 along Y; MEdx acts about the X axis (eccentricity along Y) and
 * MEdy about the Y axis (eccentricity along X).
 */
export interface PunchingShearInputEC2 {
  VEd: number;
  MEdx: number;
  MEdy: number;
  column: ColumnGeometry;
  /** Mean effective depth (dy + dz)/2, mm (EN 1992-1-1 §6.4.2(1)). */
  d: number;
  slabThickness: number;
  /** Characteristic cylinder strength fck, MPa (concrete classes C12/15 … C90/105). */
  fck: number;
  /** Bonded tension reinforcement ratios in X and Y (mean over c + 3d each side, §6.4.4(1)), fractions. */
  rhoLx: number;
  rhoLy: number;
  openings: Opening[];
  columnLocation: ColumnLocation;
  punchingReinforcement: PunchingReinforcement;
}

export interface PunchingShearResultEC2 {
  ok: true;
  status: CalculationStatus;
  demand: {
    beta: number;
    /** Which expression produced beta. */
    betaMethod: "concentric" | "6.39" | "6.43";
    /** Eccentricities MEd/VEd (mm) along X and Y. */
    eccentricityX: number;
    eccentricityY: number;
    /** vEd at the basic control perimeter u1 = beta VEd/(u1 d), MPa. */
    directShear: number;
    /** vEd,0 at the column perimeter u0 = beta VEd/(u0 d), MPa. */
    columnFaceShear: number;
    /** Governing stress used by the visualization (vEd at u1), MPa. */
    maximumShearStress: number;
    criticalPoint: PunchingCriticalPoint;
    stressProfile: PunchingCriticalPoint[][];
  };
  geometry: {
    /** Basic control perimeter dimensions by = c1 + 4d (X) and bz = c2 + 4d (Y), mm. */
    sizeX: number;
    sizeY: number;
    grossPerimeter: number;
    openingReductions: { openingIndex: number; reduction: number; applied: boolean }[];
    effectivePerimeter: number;
    /** Column perimeter u0 for an interior column, mm. */
    columnPerimeter: number;
    centroidX: number;
    centroidY: number;
    /** W1 = ∫|e| dl of the effective perimeter about the X axis (for MEdx) and Y axis (for MEdy), mm². */
    W1x: number;
    W1y: number;
    /** Effective perimeter as polylines (arcs sampled), for drawing. */
    segments: SegmentDto[];
    /** Closed outline of the gross basic control perimeter (rounded corners), for drawing. */
    grossOutline: { x: number; y: number }[];
    openingShadows: {
      openingIndex: number;
      tangentStart: { x: number; y: number };
      tangentEnd: { x: number; y: number };
      removedSegments: SegmentDto[];
    }[];
  };
  capacity: {
    k: number;
    rhoL: number;
    cRdc: number;
    /** CRd,c k (100 rhoL fck)^(1/3), MPa. */
    vRdcFormula: number;
    vMin: number;
    /** Design punching shear resistance without reinforcement, max(formula, vMin), MPa. */
    vRdc: number;
    governingExpression: "6.47" | "6.3N";
    nu: number;
    fcd: number;
    vRdMax: number;
    /** Alias of vRdc for the shared visualization / result card. */
    designStrength: number;
  };
  dcr: number;
  /** vEd / vRd,c at u1 and vEd,0 / vRd,max at the column perimeter. */
  dcrAtControlPerimeter: number;
  dcrAtColumnFace: number;
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

export type PunchingShearOutcomeEC2 = PunchingShearResultEC2 | CalculationUnavailable;
