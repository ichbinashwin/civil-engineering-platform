import type { DesignCode } from "./codes";

export type MemberType = "slab" | "beam" | "column" | "footing" | "wall";

export interface Project {
  id: string;
  name: string;
  description?: string;
  code: DesignCode;
  createdAt: Date;
  updatedAt: Date;
}

export interface StructuralMember {
  id: string;
  projectId: string;
  type: MemberType;
  name: string;
}

/** Concrete material. fc in psi; density in lb/ft^3; lambda = lightweight modification factor. */
export interface ConcreteMaterial {
  fc: number;
  density?: number;
  lambda: number;
}

/**
 * Rectangular column. c1 is the dimension along the global X axis,
 * c2 the dimension along the global Y axis (in).
 */
export interface ColumnGeometry {
  c1: number;
  c2: number;
}

/** Slab opening; coordinates relative to the column centroid (in). */
export interface CircularOpening {
  id?: string;
  type: "circle";
  centerX: number;
  centerY: number;
  diameter: number;
}

export interface RectangularOpening {
  id?: string;
  type: "rectangle";
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export type Opening = CircularOpening | RectangularOpening;

export type ColumnLocation = "interior" | "edge" | "corner";

export type PunchingReinforcement = "none" | "studRails" | "stirrups";

/**
 * Two-way punching shear input in canonical units:
 * Vu lb, Mux/Muy lb-in, lengths in, fc psi.
 * Mux acts about the global X axis; Muy acts about the global Y axis.
 */
export interface PunchingShearInput {
  Vu: number;
  Mux: number;
  Muy: number;
  column: ColumnGeometry;
  d: number;
  slabThickness: number;
  concrete: ConcreteMaterial;
  openings: Opening[];
  columnLocation: ColumnLocation;
  punchingReinforcement: PunchingReinforcement;
  options?: PunchingShearOptions;
}

export interface PunchingShearOptions {
  /**
   * Apply the size-effect factor lambda_s (ACI 318-19 §22.5.5.1.3) in Table 22.6.5.2.
   * Defaults to true. Setting false reproduces legacy working calculations that omit
   * lambda_s; the result then carries a non-conformance WARNING.
   */
  applySizeEffectFactor?: boolean;
}
