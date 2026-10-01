import type { DesignCode } from "@civil/shared-types";
import type { Calc } from "./calc";
import type { FormState } from "./form";

/**
 * Engineering compliance checklist for the selected design code (civil / structural, not application
 * security). Confirmations are made by the engineer and saved with the project; automatic checks are
 * derived from the calculation and cannot be ticked by hand. Presentation and record-keeping only.
 */
export interface ChecklistItem {
  id: string;
  label: string;
  /** Clause or source the item relates to. */
  clause?: string;
}

/** Items that apply to both US and EU designs. */
export const COMMON_ITEMS: ChecklistItem[] = [
  {
    id: "code-jurisdiction",
    label: "Design code and edition confirmed for the project jurisdiction",
  },
  {
    id: "inputs-checked",
    label: "Input data checked against the drawings and the structural model",
  },
  {
    id: "loads-verified",
    label: "Factored shear and unbalanced moments taken from the governing load combination",
  },
  {
    id: "geometry-verified",
    label: "Effective depth d and slab thickness h verified for the critical direction(s)",
  },
  {
    id: "materials-verified",
    label: "Concrete strength and reinforcement properties verified against the specification",
  },
  {
    id: "openings-reviewed",
    label:
      "All openings and penetrations near the column reviewed, including those outside the influence zone",
  },
  { id: "section-reviewed", label: "Critical section reviewed in the plan and 3D views" },
  {
    id: "warnings-reviewed",
    label: "Engine messages (ERROR / WARNING / INFO) reviewed and accepted",
  },
  {
    id: "outside-scope",
    label:
      "Checks outside this calculation addressed separately (flexure, integrity / robustness, detailing, serviceability)",
  },
  { id: "independent-review", label: "Independent engineer review completed" },
  {
    id: "record-issued",
    label: "Calculation record exported (Excel / JSON) and the revision issued",
  },
];

const ACI_ITEMS: ChecklistItem[] = [
  {
    id: "aci-edition",
    label: "ACI 318-19 and its adoption by the local building code (e.g. IBC) confirmed",
  },
  {
    id: "aci-moment-transfer",
    label: "Moment transfer γv and the unbalanced-moment assumptions confirmed",
    clause: "§8.4.2.2, §8.4.4.2",
  },
  {
    id: "aci-openings",
    label: "Opening reductions reviewed against the code provisions for openings",
    clause: "§22.6.4.3",
  },
];

const EC2_ITEMS: ChecklistItem[] = [
  {
    id: "ec2-national-annex",
    label:
      "National Annex of the project country confirmed (γc, αcc, CRd,c, vmin, vRd,max and β rules; recommended values are used)",
    clause: "EN 1992-1-1 NA",
  },
  {
    id: "ec2-rho",
    label: "ρl is the mean tension-reinforcement ratio over the column width plus 3d each side",
    clause: "§6.4.4(1)",
  },
  {
    id: "ec2-axial",
    label: "No significant axial stress or prestress in the slab (σcp = 0 assumed)",
    clause: "§6.4.4(1)",
  },
  {
    id: "ec2-beta",
    label: "β method accepted: (6.39) one axis, (6.43) both axes; opening assumptions reviewed",
    clause: "§6.4.3(3)",
  },
  {
    id: "ec2-experimental",
    label: "Experimental Eurocode 2 module understood and the result verified independently",
  },
];

export function itemsFor(code: DesignCode): { common: ChecklistItem[]; specific: ChecklistItem[] } {
  return { common: COMMON_ITEMS, specific: code === "EN 1992-1-1" ? EC2_ITEMS : ACI_ITEMS };
}

export interface AutomaticCheck {
  id: string;
  label: string;
  passed: boolean;
  detail?: string | undefined;
}

/** Read-only checks derived from the calculation (never user-editable). */
export function automaticChecks(calc: Calc, form: FormState): AutomaticCheck[] {
  const warnings = calc.outcome.warnings;
  const count = (severity: string) => warnings.filter((w) => w.severity === severity).length;
  const checks: AutomaticCheck[] = [
    {
      id: "auto-valid",
      label: "Inputs valid and the calculation available",
      passed: calc.outcome.ok,
      detail: calc.outcome.ok ? undefined : `${count("ERROR")} error(s)`,
    },
    {
      id: "auto-dcr",
      label: "Demand / capacity ratio ≤ 1.00",
      passed: calc.outcome.ok && calc.outcome.status === "PASS",
      detail: calc.outcome.ok ? `DCR ${calc.outcome.dcr.toFixed(3)}` : undefined,
    },
    {
      id: "auto-supported",
      label: "Supported case: interior column, no punching shear reinforcement",
      passed: form.columnLocation === "interior" && form.reinforcement === "none",
    },
    {
      id: "auto-warnings",
      label: "No engine WARNING raised",
      passed: count("WARNING") === 0,
      detail: `${count("WARNING")} warning(s), ${count("INFO")} info`,
    },
  ];
  if (calc.code === "ACI 318-19") {
    checks.push({
      id: "auto-aci-size-effect",
      label: "Size-effect factor λs applied (§22.5.5.1.3)",
      passed: form.applySizeEffect,
    });
  }
  return checks;
}

export interface ChecklistRecord {
  code: DesignCode;
  confirmed: number;
  total: number;
  items: { section: string; id: string; label: string; checked: boolean; automatic: boolean }[];
}

/** Snapshot for the JSON / Excel audit record. */
export function checklistRecord(calc: Calc, form: FormState): ChecklistRecord {
  const { common, specific } = itemsFor(calc.code);
  const sectionOf = (isCommon: boolean) => (isCommon ? "Common" : calc.code);
  const manual = [
    ...common.map((item) => ({ item, section: sectionOf(true) })),
    ...specific.map((item) => ({ item, section: sectionOf(false) })),
  ].map(({ item, section }) => ({
    section,
    id: item.id,
    label: item.label,
    checked: form.checklist[item.id] === true,
    automatic: false,
  }));
  const auto = automaticChecks(calc, form).map((c) => ({
    section: "Automatic",
    id: c.id,
    label: c.label,
    checked: c.passed,
    automatic: true,
  }));
  return {
    code: calc.code,
    confirmed: manual.filter((m) => m.checked).length,
    total: manual.length,
    items: [...auto, ...manual],
  };
}
