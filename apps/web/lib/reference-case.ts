import type { PunchingShearInput } from "@civil/shared-types";
import { convertForce, convertMoment } from "@civil/engineering-core";

/** Demonstration input (project reference case) in canonical units. */
export const REFERENCE_INPUT: PunchingShearInput = {
  Vu: convertForce(297, "kip", "lb"),
  Mux: convertMoment(83.7, "kip-ft", "lb-in"),
  Muy: convertMoment(6.0, "kip-ft", "lb-in"),
  column: { c1: 12, c2: 20 },
  d: 16,
  slabThickness: 18,
  concrete: { fc: 5000, lambda: 1 },
  openings: [
    { id: "O1", type: "circle", centerX: -47, centerY: 10, diameter: 3 },
    { id: "O2", type: "circle", centerX: -30, centerY: 45, diameter: 2 },
  ],
  columnLocation: "interior",
  punchingReinforcement: "none",
};
