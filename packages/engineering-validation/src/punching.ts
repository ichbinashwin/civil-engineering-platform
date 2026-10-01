import { z } from "zod";
import type {
  CalculationWarning,
  PunchingShearInput,
  PunchingShearInputEC2,
} from "@civil/shared-types";

/**
 * Structural (shape) schema for two-way punching shear input in canonical units
 * (lb, in, lb-in, psi). Engineering-aware rules live in validatePunchingInput.
 */
const CircularOpeningSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("circle"),
  centerX: z.number(),
  centerY: z.number(),
  diameter: z.number().positive(),
});

const RectangularOpeningSchema = z.object({
  id: z.string().max(64).optional(),
  type: z.literal("rectangle"),
  centerX: z.number(),
  centerY: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

export const OpeningSchema = z.discriminatedUnion("type", [
  CircularOpeningSchema,
  RectangularOpeningSchema,
]);

export const PunchingInputSchema = z.object({
  Vu: z.number().nonnegative(),
  Mux: z.number(),
  Muy: z.number(),
  column: z.object({
    c1: z.number().positive(),
    c2: z.number().positive(),
  }),
  d: z.number().positive(),
  slabThickness: z.number().positive(),
  concrete: z.object({
    fc: z.number().positive(),
    density: z.number().positive().optional(),
    lambda: z.number().positive().max(1),
  }),
  openings: z.array(OpeningSchema).max(50),
  columnLocation: z.enum(["interior", "edge", "corner"]),
  punchingReinforcement: z.enum(["none", "studRails", "stirrups"]),
  options: z
    .object({
      applySizeEffectFactor: z.boolean().optional(),
      momentSignConvention: z.enum(["envelope", "signed"]).optional(),
    })
    .optional(),
});

/** Minimum specified f'c for structural concrete, ACI 318-19 Table 19.2.1.1 (psi). */
const MIN_STRUCTURAL_FC_PSI = 2500;

export type PunchingValidation =
  | { ok: true; input: PunchingShearInput; issues: CalculationWarning[] }
  | { ok: false; issues: CalculationWarning[] };

function hasErrors(issues: CalculationWarning[]): boolean {
  return issues.some((issue) => issue.severity === "ERROR");
}

/**
 * Validates shape (Zod) and engineering rules. Geometry-dependent opening checks
 * (overlap with column, proximity to the critical section) are performed by the engine.
 */
export function validatePunchingInput(raw: unknown): PunchingValidation {
  const parsed = PunchingInputSchema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        severity: "ERROR",
        code: "INVALID_INPUT",
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  // Shape is now guaranteed to match PunchingShearInput.
  const input = raw as PunchingShearInput;
  const issues: CalculationWarning[] = [];

  if (input.d >= input.slabThickness) {
    issues.push({
      severity: "ERROR",
      code: "D_EXCEEDS_H",
      field: "d",
      message: "Effective depth d must be less than slab thickness h.",
    });
  }

  if (input.columnLocation !== "interior") {
    issues.push({
      severity: "ERROR",
      code: "UNSUPPORTED_COLUMN_LOCATION",
      field: "columnLocation",
      message: `Column location "${input.columnLocation}" is not implemented. Only interior columns are supported.`,
    });
  }

  if (input.punchingReinforcement !== "none") {
    issues.push({
      severity: "ERROR",
      code: "UNSUPPORTED_REINFORCEMENT",
      field: "punchingReinforcement",
      message:
        "Punching shear reinforcement is not implemented. Only slabs without shear reinforcement are supported.",
    });
  }

  if (input.concrete.fc < MIN_STRUCTURAL_FC_PSI) {
    issues.push({
      severity: "WARNING",
      code: "LOW_FC",
      field: "concrete.fc",
      message: `f'c = ${input.concrete.fc} psi is below the ${MIN_STRUCTURAL_FC_PSI} psi general minimum for structural concrete (ACI 318-19 Table 19.2.1.1).`,
    });
  }

  input.openings.forEach((opening, index) => {
    if (Math.hypot(opening.centerX, opening.centerY) === 0) {
      issues.push({
        severity: "ERROR",
        code: "OPENING_AT_COLUMN_CENTROID",
        field: `openings.${index}`,
        message: `Opening ${index + 1} is centered on the column centroid.`,
      });
    }
  });

  return hasErrors(issues) ? { ok: false, issues } : { ok: true, input, issues };
}

// ── Eurocode 2 (EN 1992-1-1) ────────────────────────────────────────────────────────────────────

/** Lowest / highest concrete strength class of EN 1992-1-1 Table 3.1 (fck, MPa). */
const EC2_FCK_MIN = 12;
const EC2_FCK_MAX = 90;
/** Reinforcement ratio above which ρl is capped (EN 1992-1-1 §6.4.4(1)). */
const EC2_RHO_CAP = 0.02;

export const PunchingInputEC2Schema = z.object({
  VEd: z.number().nonnegative(),
  MEdx: z.number(),
  MEdy: z.number(),
  column: z.object({
    c1: z.number().positive(),
    c2: z.number().positive(),
  }),
  d: z.number().positive(),
  slabThickness: z.number().positive(),
  fck: z.number().positive(),
  rhoLx: z.number().nonnegative(),
  rhoLy: z.number().nonnegative(),
  openings: z.array(OpeningSchema).max(50),
  columnLocation: z.enum(["interior", "edge", "corner"]),
  punchingReinforcement: z.enum(["none", "studRails", "stirrups"]),
});

export type PunchingValidationEC2 =
  | { ok: true; input: PunchingShearInputEC2; issues: CalculationWarning[] }
  | { ok: false; issues: CalculationWarning[] };

export function validatePunchingInputEC2(raw: unknown): PunchingValidationEC2 {
  const parsed = PunchingInputEC2Schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      issues: parsed.error.issues.map((issue) => ({
        severity: "ERROR",
        code: "INVALID_INPUT",
        field: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  const input = raw as PunchingShearInputEC2;
  const issues: CalculationWarning[] = [];
  const error = (code: string, field: string, message: string) =>
    issues.push({ severity: "ERROR", code, field, message });

  if (input.d >= input.slabThickness) {
    error("D_EXCEEDS_H", "d", "Effective depth d must be less than slab thickness h.");
  }
  if (!(input.VEd > 0)) {
    error(
      "VED_NOT_POSITIVE",
      "VEd",
      "VEd must be greater than zero (the eccentricity MEd/VEd is undefined otherwise).",
    );
  }
  if (input.fck < EC2_FCK_MIN || input.fck > EC2_FCK_MAX) {
    error(
      "FCK_OUT_OF_RANGE",
      "fck",
      `fck = ${input.fck} MPa is outside the concrete classes C12/15 to C90/105 (EN 1992-1-1 Table 3.1).`,
    );
  }
  if (input.columnLocation !== "interior") {
    error(
      "UNSUPPORTED_COLUMN_LOCATION",
      "columnLocation",
      `Column location "${input.columnLocation}" is not implemented. Only interior columns are supported.`,
    );
  }
  if (input.punchingReinforcement !== "none") {
    error(
      "UNSUPPORTED_REINFORCEMENT",
      "punchingReinforcement",
      "Punching shear reinforcement is not implemented. Only slabs without shear reinforcement are supported.",
    );
  }
  input.openings.forEach((opening, index) => {
    if (Math.hypot(opening.centerX, opening.centerY) === 0) {
      error(
        "OPENING_AT_COLUMN_CENTROID",
        `openings.${index}`,
        `Opening ${index + 1} is centered on the column centroid.`,
      );
    }
  });

  if (issues.length > 0) return { ok: false, issues };

  if (input.rhoLx > EC2_RHO_CAP || input.rhoLy > EC2_RHO_CAP) {
    issues.push({
      severity: "INFO",
      code: "RHO_ABOVE_CAP",
      field: "rhoLx",
      message: `A reinforcement ratio above ${EC2_RHO_CAP * 100} % is entered; ρl is capped at ${EC2_RHO_CAP * 100} % (EN 1992-1-1 §6.4.4(1)).`,
    });
  }
  return { ok: true, input, issues };
}
