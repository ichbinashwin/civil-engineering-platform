import type { ColumnGeometry, Opening } from "@civil/shared-types";

/**
 * Everything the plan and 3D views need besides the result geometry, already in display units and
 * labels, so the views are independent of the design code. Presentation only.
 */
export interface VizInput {
  column: ColumnGeometry;
  d: number;
  slabThickness: number;
  openings: Opening[];
  lengthUnit: "in" | "mm";
  stressUnit: "psi" | "MPa";
  stressDigits: number;
  /** Label of the governing stress, e.g. "vu,max" or "vEd". */
  demandLabel: string;
  /** Label of the design strength, e.g. "φvc" or "vRd,c". */
  capacityLabel: string;
  /** Labels of the critical-section size dimensions, e.g. "c1 + d" or "c1 + 4d". */
  dimXLabel: string;
  dimYLabel: string;
  momentUnit: string;
  /** Pre-formatted load labels (value only, units in momentUnit / forceUnit). */
  forceValue: string;
  forceUnit: string;
  momentXValue: string;
  momentYValue: string;
  /** Label of the controlling perimeter, e.g. "bo" or "u1". */
  perimeterSymbol: string;
  /** Rows of the perimeter inspector (label, formatted value with unit). */
  perimeterRows: { label: string; value: string }[];
}
