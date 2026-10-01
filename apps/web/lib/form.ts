import type {
  CalculationWarning,
  ColumnLocation,
  Opening,
  PunchingReinforcement,
  PunchingShearInput,
} from "@civil/shared-types";
import { convertForce, convertMoment } from "@civil/engineering-core";

/**
 * Editable form state in display units (kip, kip-ft, in, psi). Values are kept as strings so the
 * engineer can type freely; parsing and unit conversion happen once in toEngineInput.
 * No engineering formulas belong in this file.
 */
export interface OpeningForm {
  key: string;
  type: "circle" | "rectangle";
  x: string;
  y: string;
  diameter: string;
  width: string;
  height: string;
}

export interface FormState {
  projectName: string;
  engineer: string;
  memberName: string;
  revision: string;
  Vu: string;
  Mux: string;
  Muy: string;
  c1: string;
  c2: string;
  d: string;
  h: string;
  fc: string;
  lambda: string;
  columnLocation: ColumnLocation;
  reinforcement: PunchingReinforcement;
  applySizeEffect: boolean;
  openings: OpeningForm[];
}

export type NumericField = "Vu" | "Mux" | "Muy" | "c1" | "c2" | "d" | "h" | "fc" | "lambda";

let openingCounter = 0;
export function newOpeningKey(): string {
  openingCounter += 1;
  return `opening-${Date.now().toString(36)}-${openingCounter}`;
}

export function createOpening(x = "-40", y = "0"): OpeningForm {
  return { key: newOpeningKey(), type: "circle", x, y, diameter: "4", width: "6", height: "6" };
}

export const EXAMPLE_FORM: FormState = {
  projectName: "Reference project",
  engineer: "",
  memberName: "Slab S1 — Column C4",
  revision: "0",
  Vu: "297",
  Mux: "83.7",
  Muy: "6",
  c1: "12",
  c2: "20",
  d: "16",
  h: "18",
  fc: "5000",
  lambda: "1",
  columnLocation: "interior",
  reinforcement: "none",
  applySizeEffect: true,
  openings: [
    { key: "ref-o1", type: "circle", x: "-47", y: "10", diameter: "3", width: "3", height: "3" },
    { key: "ref-o2", type: "circle", x: "-30", y: "45", diameter: "2", width: "2", height: "2" },
  ],
};

/** Strict numeric parse: empty or non-numeric text becomes NaN (rejected by validation), never 0. */
export function parseNumber(text: string): number {
  const trimmed = text.trim();
  return trimmed === "" ? Number.NaN : Number(trimmed);
}

function toOpening(o: OpeningForm): Opening {
  const base = { id: o.key, centerX: parseNumber(o.x), centerY: parseNumber(o.y) };
  return o.type === "circle"
    ? { ...base, type: "circle", diameter: parseNumber(o.diameter) }
    : { ...base, type: "rectangle", width: parseNumber(o.width), height: parseNumber(o.height) };
}

/** Converts display-unit form state into canonical engine input (lb, in, lb-in, psi). */
export function toEngineInput(form: FormState): PunchingShearInput {
  return {
    Vu: convertForce(parseNumber(form.Vu), "kip", "lb"),
    Mux: convertMoment(parseNumber(form.Mux), "kip-ft", "lb-in"),
    Muy: convertMoment(parseNumber(form.Muy), "kip-ft", "lb-in"),
    column: { c1: parseNumber(form.c1), c2: parseNumber(form.c2) },
    d: parseNumber(form.d),
    slabThickness: parseNumber(form.h),
    concrete: { fc: parseNumber(form.fc), lambda: parseNumber(form.lambda) },
    openings: form.openings.map(toOpening),
    columnLocation: form.columnLocation,
    punchingReinforcement: form.reinforcement,
    options: { applySizeEffectFactor: form.applySizeEffect },
  };
}

const ENGINE_FIELD_TO_FORM: Record<string, NumericField> = {
  Vu: "Vu",
  Mux: "Mux",
  Muy: "Muy",
  "column.c1": "c1",
  "column.c2": "c2",
  d: "d",
  slabThickness: "h",
  "concrete.fc": "fc",
  "concrete.lambda": "lambda",
};

const OPENING_FIELD_TO_FORM: Record<string, keyof OpeningForm> = {
  centerX: "x",
  centerY: "y",
  diameter: "diameter",
  width: "width",
  height: "height",
};

/**
 * Maps engine issue field paths ("column.c1", "openings.1.diameter") onto form field ids
 * ("c1", "openings.1.diameter" → "opening:<key>:diameter").
 */
export function fieldMessages(
  issues: CalculationWarning[],
  form: FormState,
): Map<string, CalculationWarning[]> {
  const map = new Map<string, CalculationWarning[]>();
  const add = (id: string, issue: CalculationWarning) =>
    map.set(id, [...(map.get(id) ?? []), issue]);
  for (const issue of issues) {
    if (!issue.field) continue;
    const direct = ENGINE_FIELD_TO_FORM[issue.field];
    if (direct) {
      add(direct, issue);
      continue;
    }
    const match = /^openings\.(\d+)(?:\.(\w+))?$/.exec(issue.field);
    if (match) {
      const opening = form.openings[Number(match[1])];
      if (!opening) continue;
      const sub = match[2] ? OPENING_FIELD_TO_FORM[match[2]] : undefined;
      add(sub ? `opening:${opening.key}:${sub}` : `opening:${opening.key}`, issue);
    }
  }
  return map;
}
