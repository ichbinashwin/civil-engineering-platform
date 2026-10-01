import type {
  DesignCode,
  PunchingShearInput,
  PunchingShearInputEC2,
  PunchingShearOutcome,
  PunchingShearOutcomeEC2,
  PunchingVizOutcome,
} from "@civil/shared-types";
import {
  calculatePunchingShear,
  calculatePunchingShearEC2,
  convertForce,
  convertMoment,
} from "@civil/engineering-core";
import { toEngineInput, toEngineInputEC2 } from "./form";
import type { EngineFields } from "./form";
import { formatNumber } from "./format";
import type { VizInput } from "./viz-model";

/** One calculation, tagged by design code. Only the selected code is ever computed. */
export interface AciCalc {
  code: "ACI 318-19";
  input: PunchingShearInput;
  outcome: PunchingShearOutcome;
}
export interface Ec2Calc {
  code: "EN 1992-1-1";
  input: PunchingShearInputEC2;
  outcome: PunchingShearOutcomeEC2;
}
export type Calc = AciCalc | Ec2Calc;

export function runCalc(form: EngineFields): Calc {
  if (form.code === "EN 1992-1-1") {
    const input = toEngineInputEC2(form);
    return { code: "EN 1992-1-1", input, outcome: calculatePunchingShearEC2(input) };
  }
  const input = toEngineInput(form);
  return { code: "ACI 318-19", input, outcome: calculatePunchingShear(input) };
}

export const CODE_LABELS: Record<DesignCode, { short: string; region: string; title: string }> = {
  "ACI 318-19": { short: "ACI 318-19", region: "US", title: "ACI 318-19 Punching Shear" },
  "EN 1992-1-1": {
    short: "EN 1992-1-1",
    region: "EU",
    title: "EN 1992-1-1 (Eurocode 2) Punching Shear",
  },
};

export interface Kpi {
  label: string;
  value: string;
  unit: string;
}

export function kpisOf(calc: Calc): Kpi[] {
  if (!calc.outcome.ok) {
    return calc.code === "ACI 318-19"
      ? [
          { label: "Effective perimeter bo", value: "—", unit: "in" },
          { label: "Maximum vu", value: "—", unit: "psi" },
          { label: "Design φvc", value: "—", unit: "psi" },
          { label: "DCR", value: "—", unit: "unavailable" },
        ]
      : [
          { label: "Control perimeter u1", value: "—", unit: "mm" },
          { label: "Design shear vEd", value: "—", unit: "MPa" },
          { label: "Resistance vRd,c", value: "—", unit: "MPa" },
          { label: "DCR", value: "—", unit: "unavailable" },
        ];
  }
  if (calc.code === "ACI 318-19") {
    const r = calc.outcome as Extract<PunchingShearOutcome, { ok: true }>;
    return [
      {
        label: "Effective perimeter bo",
        value: formatNumber(r.geometry.effectivePerimeter, 2),
        unit: "in",
      },
      { label: "Maximum vu", value: formatNumber(r.demand.maximumShearStress, 1), unit: "psi" },
      { label: "Design φvc", value: formatNumber(r.capacity.designStrength, 1), unit: "psi" },
      { label: "DCR", value: formatNumber(r.dcr, 3), unit: r.status },
    ];
  }
  const r = calc.outcome as Extract<PunchingShearOutcomeEC2, { ok: true }>;
  return [
    {
      label: "Control perimeter u1",
      value: formatNumber(r.geometry.effectivePerimeter, 0),
      unit: "mm",
    },
    { label: "Design shear vEd", value: formatNumber(r.demand.directShear, 3), unit: "MPa" },
    { label: "Resistance vRd,c", value: formatNumber(r.capacity.vRdc, 3), unit: "MPa" },
    { label: "DCR", value: formatNumber(r.dcr, 3), unit: r.status },
  ];
}

export interface ResultSummary {
  dcr: number;
  status: "PASS" | "FAIL" | "WARNING";
  governingCheck: string;
  demandLabel: string;
  demand: number;
  capacityLabel: string;
  capacity: number;
  unit: string;
  digits: number;
  note: string;
}

/** Null when the calculation is unavailable. */
export function summaryOf(calc: Calc): ResultSummary | null {
  if (!calc.outcome.ok) return null;
  if (calc.code === "ACI 318-19") {
    const r = calc.outcome as Extract<PunchingShearOutcome, { ok: true }>;
    return {
      dcr: r.dcr,
      status: r.status,
      governingCheck: r.governingCheck,
      demandLabel: "vu,max",
      demand: r.demand.maximumShearStress,
      capacityLabel: "φvc",
      capacity: r.capacity.designStrength,
      unit: "psi",
      digits: 1,
      note: "DCR ≤ 1.00 → PASS. No punching shear reinforcement assumed.",
    };
  }
  const r = calc.outcome as Extract<PunchingShearOutcomeEC2, { ok: true }>;
  const atColumn = r.dcrAtColumnFace > r.dcrAtControlPerimeter;
  return {
    dcr: r.dcr,
    status: r.status,
    governingCheck: r.governingCheck,
    demandLabel: atColumn ? "vEd,0" : "vEd",
    demand: atColumn ? r.demand.columnFaceShear : r.demand.directShear,
    capacityLabel: atColumn ? "vRd,max" : "vRd,c",
    capacity: atColumn ? r.capacity.vRdMax : r.capacity.vRdc,
    unit: "MPa",
    digits: 3,
    note: "DCR ≤ 1.00 → PASS (larger of vEd/vRd,c at u1 and vEd,0/vRd,max at the column). No punching shear reinforcement. Experimental.",
  };
}

/** Plan / 3D inputs in display units, and the code-agnostic result geometry. */
export function vizOf(calc: Calc): { input: VizInput; outcome: PunchingVizOutcome } {
  if (calc.code === "ACI 318-19") {
    const i = calc.input;
    const r = calc.outcome.ok ? calc.outcome : null;
    return {
      input: {
        column: i.column,
        d: i.d,
        slabThickness: i.slabThickness,
        openings: i.openings,
        lengthUnit: "in",
        stressUnit: "psi",
        stressDigits: 1,
        demandLabel: "vu,max",
        capacityLabel: "φvc",
        dimXLabel: "c1 + d",
        dimYLabel: "c2 + d",
        momentUnit: "kip-ft",
        forceValue: formatNumber(convertForce(i.Vu, "lb", "kip"), 1),
        forceUnit: "kip",
        momentXValue: formatNumber(convertMoment(i.Mux, "lb-in", "kip-ft"), 1),
        momentYValue: formatNumber(convertMoment(i.Muy, "lb-in", "kip-ft"), 1),
        perimeterSymbol: "bo",
        perimeterRows: r
          ? [
              {
                label: "bo (effective)",
                value: `${formatNumber(r.geometry.effectivePerimeter, 3)} in`,
              },
              {
                label: "centroid",
                value: `(${formatNumber(r.geometry.centroidX, 3)}, ${formatNumber(r.geometry.centroidY, 3)})`,
              },
              { label: "Ix", value: `${formatNumber(r.geometry.Ix, 0)} in³` },
              { label: "Iy", value: `${formatNumber(r.geometry.Iy, 0)} in³` },
              { label: "Jx", value: `${formatNumber(r.geometry.Jx, 0)} in⁴` },
              { label: "Jy", value: `${formatNumber(r.geometry.Jy, 0)} in⁴` },
              { label: "Jxy", value: `${formatNumber(r.geometry.Jxy, 1)} in⁴` },
            ]
          : [],
      },
      outcome: calc.outcome,
    };
  }
  const i = calc.input;
  const r = calc.outcome.ok ? calc.outcome : null;
  return {
    input: {
      column: i.column,
      d: i.d,
      slabThickness: i.slabThickness,
      openings: i.openings,
      lengthUnit: "mm",
      stressUnit: "MPa",
      stressDigits: 3,
      demandLabel: "vEd",
      capacityLabel: "vRd,c",
      dimXLabel: "by = c1 + 4d",
      dimYLabel: "bz = c2 + 4d",
      momentUnit: "kN·m",
      forceValue: formatNumber(convertForce(i.VEd, "N", "kN"), 1),
      forceUnit: "kN",
      momentXValue: formatNumber(convertMoment(i.MEdx, "N-mm", "kN-m"), 1),
      momentYValue: formatNumber(convertMoment(i.MEdy, "N-mm", "kN-m"), 1),
      perimeterSymbol: "u1",
      perimeterRows: r
        ? [
            {
              label: "u1 (effective)",
              value: `${formatNumber(r.geometry.effectivePerimeter, 1)} mm`,
            },
            { label: "u0 (column)", value: `${formatNumber(r.geometry.columnPerimeter, 1)} mm` },
            {
              label: "centroid",
              value: `(${formatNumber(r.geometry.centroidX, 2)}, ${formatNumber(r.geometry.centroidY, 2)})`,
            },
            { label: "W1x (about X)", value: `${formatNumber(r.geometry.W1x, 0)} mm²` },
            { label: "W1y (about Y)", value: `${formatNumber(r.geometry.W1y, 0)} mm²` },
            { label: "β", value: `${formatNumber(r.demand.beta, 4)} (${r.demand.betaMethod})` },
          ]
        : [],
    },
    outcome: calc.outcome,
  };
}
