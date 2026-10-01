import type {
  CalculationWarning,
  ColumnLocation,
  DesignCode,
  Opening,
  PunchingReinforcement,
  PunchingShearInput,
  PunchingShearInputEC2,
} from "@civil/shared-types";
import { convertForce, convertLength, convertMoment, convertStress } from "@civil/engineering-core";

/**
 * Editable form state in the display units of the selected design code (US: kip, kip-ft, in, psi;
 * EU: kN, kN·m, mm, MPa). Values are kept as strings so the engineer can type freely; parsing and
 * unit conversion happen once in toEngineInput / toEngineInputEC2. No engineering formulas belong here.
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
  code: DesignCode;
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
  /** f'c (ACI, psi) or fck (EN 1992-1-1, MPa). */
  fc: string;
  lambda: string;
  /** Reinforcement ratios ρlx, ρly in percent (EN 1992-1-1 only). */
  rhoX: string;
  rhoY: string;
  columnLocation: ColumnLocation;
  reinforcement: PunchingReinforcement;
  applySizeEffect: boolean;
  momentSign: "envelope" | "signed";
  openings: OpeningForm[];
  /** Engineer confirmations of the compliance checklist (id → ticked). */
  checklist: Record<string, boolean>;
}

/** The fields that feed the engine; everything else (names, checklist …) never triggers a recalculation. */
export type EngineFields = Pick<
  FormState,
  | "code"
  | "Vu"
  | "Mux"
  | "Muy"
  | "c1"
  | "c2"
  | "d"
  | "h"
  | "fc"
  | "lambda"
  | "rhoX"
  | "rhoY"
  | "columnLocation"
  | "reinforcement"
  | "applySizeEffect"
  | "momentSign"
  | "openings"
>;

export type NumericField =
  "Vu" | "Mux" | "Muy" | "c1" | "c2" | "d" | "h" | "fc" | "lambda" | "rhoX" | "rhoY";

export const DESIGN_CODES: DesignCode[] = ["ACI 318-19", "EN 1992-1-1"];
export const DEFAULT_CODE: DesignCode = "ACI 318-19";

export interface UnitSystem {
  force: "kip" | "kN";
  moment: "kip-ft" | "kN-m";
  length: "in" | "mm";
  stress: "psi" | "MPa";
  /** Display labels. */
  momentLabel: string;
}

export const UNIT_SYSTEMS: Record<DesignCode, UnitSystem> = {
  "ACI 318-19": {
    force: "kip",
    moment: "kip-ft",
    length: "in",
    stress: "psi",
    momentLabel: "kip-ft",
  },
  "EN 1992-1-1": { force: "kN", moment: "kN-m", length: "mm", stress: "MPa", momentLabel: "kN·m" },
};

let openingCounter = 0;
export function newOpeningKey(): string {
  openingCounter += 1;
  return `opening-${Date.now().toString(36)}-${openingCounter}`;
}

/** New opening placed 40 in / 1000 mm to the left of the column. */
export function createOpening(code: DesignCode = DEFAULT_CODE): OpeningForm {
  const metric = UNIT_SYSTEMS[code].length === "mm";
  return {
    key: newOpeningKey(),
    type: "circle",
    x: metric ? "-1000" : "-40",
    y: "0",
    diameter: metric ? "100" : "4",
    width: metric ? "150" : "6",
    height: metric ? "150" : "6",
  };
}

const COMMON_FIELDS = {
  projectName: "Reference project",
  engineer: "",
  revision: "0",
  columnLocation: "interior" as const,
  reinforcement: "none" as const,
  applySizeEffect: true,
  momentSign: "envelope" as const,
  checklist: {} as Record<string, boolean>,
  lambda: "1",
  rhoX: "1.0",
  rhoY: "1.0",
};

export const EXAMPLE_FORM_ACI: FormState = {
  ...COMMON_FIELDS,
  code: "ACI 318-19",
  memberName: "Slab S1 — Column C4",
  Vu: "297",
  Mux: "83.7",
  Muy: "6",
  c1: "12",
  c2: "20",
  d: "16",
  h: "18",
  fc: "5000",
  openings: [
    { key: "ref-o1", type: "circle", x: "-47", y: "10", diameter: "3", width: "3", height: "3" },
    { key: "ref-o2", type: "circle", x: "-30", y: "45", diameter: "2", width: "2", height: "2" },
  ],
};

export const EXAMPLE_FORM_EC2: FormState = {
  ...COMMON_FIELDS,
  code: "EN 1992-1-1",
  memberName: "Slab S1 — Column C4",
  Vu: "500",
  Mux: "0",
  Muy: "30",
  c1: "400",
  c2: "400",
  d: "200",
  h: "250",
  fc: "30",
  openings: [
    {
      key: "ref-o1",
      type: "circle",
      x: "-700",
      y: "150",
      diameter: "150",
      width: "150",
      height: "150",
    },
    {
      key: "ref-o2",
      type: "circle",
      x: "-1900",
      y: "0",
      diameter: "200",
      width: "200",
      height: "200",
    },
  ],
};

/** Backwards-compatible default example (US). */
export const EXAMPLE_FORM: FormState = EXAMPLE_FORM_ACI;

export function exampleFor(code: DesignCode): FormState {
  return code === "EN 1992-1-1" ? EXAMPLE_FORM_EC2 : EXAMPLE_FORM_ACI;
}

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

/** Converts display-unit form state into canonical ACI engine input (lb, in, lb-in, psi). */
export function toEngineInput(form: EngineFields): PunchingShearInput {
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
    options: { applySizeEffectFactor: form.applySizeEffect, momentSignConvention: form.momentSign },
  };
}

/** Converts display-unit form state into canonical EN 1992-1-1 engine input (N, N·mm, mm, MPa). */
export function toEngineInputEC2(form: EngineFields): PunchingShearInputEC2 {
  return {
    VEd: convertForce(parseNumber(form.Vu), "kN", "N"),
    MEdx: convertMoment(parseNumber(form.Mux), "kN-m", "N-mm"),
    MEdy: convertMoment(parseNumber(form.Muy), "kN-m", "N-mm"),
    column: { c1: parseNumber(form.c1), c2: parseNumber(form.c2) },
    d: parseNumber(form.d),
    slabThickness: parseNumber(form.h),
    fck: parseNumber(form.fc),
    rhoLx: parseNumber(form.rhoX) / 100,
    rhoLy: parseNumber(form.rhoY) / 100,
    openings: form.openings.map(toOpening),
    columnLocation: form.columnLocation,
    punchingReinforcement: form.reinforcement,
  };
}

/** Decimal places kept when a value is converted between unit systems. */
const CONVERSION_DECIMALS: Record<DesignCode, number> = { "ACI 318-19": 2, "EN 1992-1-1": 1 };

function convertText(text: string, convert: (v: number) => number, decimals: number): string {
  const value = parseNumber(text);
  if (!Number.isFinite(value)) return text;
  return String(Number(convert(value).toFixed(decimals)));
}

/**
 * Switches the design code and converts every dimensional value to the new unit system, keeping the
 * engineer's data (rounded to 1 decimal in SI, 2 in US). Non-dimensional fields are kept.
 */
export function convertFormToCode(form: FormState, to: DesignCode): FormState {
  if (form.code === to) return form;
  const from = UNIT_SYSTEMS[form.code];
  const target = UNIT_SYSTEMS[to];
  const dp = CONVERSION_DECIMALS[to];
  const force = (t: string) => convertText(t, (v) => convertForce(v, from.force, target.force), dp);
  const moment = (t: string) =>
    convertText(t, (v) => convertMoment(v, from.moment, target.moment), dp);
  const length = (t: string) =>
    convertText(t, (v) => convertLength(v, from.length, target.length), dp);
  // Concrete strength: whole psi in US, 0.1 MPa in SI.
  const stress = (t: string) =>
    convertText(
      t,
      (v) => convertStress(v, from.stress, target.stress),
      to === "ACI 318-19" ? 0 : 1,
    );
  return {
    ...form,
    code: to,
    Vu: force(form.Vu),
    Mux: moment(form.Mux),
    Muy: moment(form.Muy),
    c1: length(form.c1),
    c2: length(form.c2),
    d: length(form.d),
    h: length(form.h),
    fc: stress(form.fc),
    openings: form.openings.map((o) => ({
      ...o,
      x: length(o.x),
      y: length(o.y),
      diameter: length(o.diameter),
      width: length(o.width),
      height: length(o.height),
    })),
  };
}

const ENGINE_FIELD_TO_FORM: Record<string, NumericField> = {
  Vu: "Vu",
  VEd: "Vu",
  Mux: "Mux",
  MEdx: "Mux",
  Muy: "Muy",
  MEdy: "Muy",
  "column.c1": "c1",
  "column.c2": "c2",
  d: "d",
  slabThickness: "h",
  "concrete.fc": "fc",
  fck: "fc",
  "concrete.lambda": "lambda",
  rhoLx: "rhoX",
  rhoLy: "rhoY",
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
  form: Pick<FormState, "openings">,
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
