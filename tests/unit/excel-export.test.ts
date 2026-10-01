import ExcelJS from "exceljs";
import { describe, expect, it } from "vitest";
import { calculatePunchingShear, calculatePunchingShearEC2 } from "@civil/engineering-core";
import {
  SHEET_NAMES,
  SHEET_NAMES_EC2,
  exportPunchingWorkbook,
  exportPunchingWorkbookEC2,
  safeText,
} from "@civil/engineering-excel";
import type { AuditChecklistItem } from "@civil/engineering-excel";
import type {
  PunchingShearInput,
  PunchingShearInputEC2,
  PunchingShearResult,
  PunchingShearResultEC2,
} from "@civil/shared-types";
import { REFERENCE_CASE, referenceWith } from "../fixtures/punching-reference";

const PROJECT = {
  name: "Reference project",
  member: "Slab S1 — Column C4",
  engineer: '=HYPERLINK("x")',
  revision: "1",
};

function result(input: PunchingShearInput): PunchingShearResult {
  const r = calculatePunchingShear(input);
  if (!r.ok) throw new Error(r.reason);
  return r;
}

async function roundTrip(input: PunchingShearInput) {
  const r = result(input);
  const bytes = await exportPunchingWorkbook({
    project: PROJECT,
    input,
    result: r,
    review: null,
    exportedAt: new Date("2026-10-01T00:00:00Z"),
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  return { wb, r };
}

/**
 * Minimal test-only evaluator for the worksheet formulas used by the export
 * (+ − * /, comparisons, SQRT, MIN, MAX, ABS, IF, cross-sheet absolute references).
 */
function evaluator(wb: ExcelJS.Workbook) {
  const cache = new Map<string, unknown>();
  const valueOf = (sheet: string, address: string): unknown => {
    const key = `${sheet}!${address}`;
    if (cache.has(key)) return cache.get(key);
    const cell = wb.getWorksheet(sheet)?.getCell(address);
    if (!cell) throw new Error(`Missing cell ${key}`);
    const v = cell.value as ExcelJS.CellValue;
    const out =
      v !== null && typeof v === "object" && "formula" in v ? evaluate(v.formula, sheet) : v;
    cache.set(key, out);
    return out;
  };
  const evaluate = (formula: string, currentSheet: string): unknown => {
    const js = formula
      .replace(
        /(?:'([^']+)'|([A-Za-z_][\w ]*?))!\$([A-Z]+)\$(\d+)/g,
        (_m, q: string | undefined, s: string | undefined, col: string, row: string) =>
          `(${JSON.stringify(valueOf((q ?? s) as string, `${col}${row}`))})`,
      )
      .replace(
        /\$([A-Z]+)\$(\d+)/g,
        (_m, col: string, row: string) =>
          `(${JSON.stringify(valueOf(currentSheet, `${col}${row}`))})`,
      )
      .replace(/\bPI\(\)/g, "Math.PI")
      .replace(/\^/g, "**")
      .replace(/\bSQRT\(/g, "Math.sqrt(")
      .replace(/\bMIN\(/g, "Math.min(")
      .replace(/\bMAX\(/g, "Math.max(")
      .replace(/\bABS\(/g, "Math.abs(")
      .replace(/\bIF\(/g, "__if(")
      .replace(/<>/g, "!==");
    return new Function("__if", `return (${js});`)((c: unknown, a: unknown, b: unknown) =>
      c ? a : b,
    );
  };
  return evaluate;
}

describe("formatted Excel export", () => {
  it("contains the six specified sheets in order", async () => {
    const { wb } = await roundTrip(REFERENCE_CASE);
    expect(wb.worksheets.map((w) => w.name)).toEqual(Object.values(SHEET_NAMES));
  });

  it.each([
    ["reference case", REFERENCE_CASE],
    ["no openings", referenceWith({ openings: [] })],
    ["lambda_s omitted", { ...REFERENCE_CASE, options: { applySizeEffectFactor: false } }],
    ["elongated column (vc b)", referenceWith({ column: { c1: 12, c2: 48 }, openings: [] })],
    ["failing case", referenceWith({ Vu: 600_000 })],
  ])("every formula reproduces the engine value: %s", async (_name, input) => {
    const { wb, r } = await roundTrip(input as PunchingShearInput);
    const evaluate = evaluator(wb);
    let formulas = 0;
    for (const ws of wb.worksheets) {
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          const v = cell.value as ExcelJS.CellValue;
          if (v === null || typeof v !== "object" || !("formula" in v)) return;
          formulas += 1;
          const computed = evaluate(v.formula, ws.name);
          const cached = (v as ExcelJS.CellFormulaValue).result;
          // ExcelJS drops a cached result of 0 on write (Excel recalculates on load).
          if (cached === undefined) expect(computed as number).toBeCloseTo(0, 9);
          else if (typeof cached === "number") expect(computed as number).toBeCloseTo(cached, 6);
          else expect(computed).toEqual(cached);
        }),
      );
    }
    expect(formulas).toBeGreaterThan(20);
    const capacity = wb.getWorksheet(SHEET_NAMES.capacity)!;
    let dcrSeen = false;
    capacity.eachRow((row) => {
      if (row.getCell(2).value === "DCR") {
        dcrSeen = true;
        expect(row.getCell(4).value).toBeCloseTo(r.dcr, 12);
      }
    });
    expect(dcrSeen).toBe(true);
  });

  it("writes user text as plain text, never as a formula", async () => {
    const { wb } = await roundTrip(REFERENCE_CASE);
    const summary = wb.getWorksheet(SHEET_NAMES.summary)!;
    let found = false;
    summary.eachRow((row) =>
      row.eachCell((cell) => {
        if (typeof cell.value === "string" && cell.value.includes("HYPERLINK")) {
          found = true;
          expect(cell.value.startsWith("'")).toBe(true);
        }
      }),
    );
    expect(found).toBe(true);
    expect(safeText("=1+1")).toBe("'=1+1");
    expect(safeText("ok\u0007text")).toBe("oktext");
  });

  it("audit sheet records engine version and input snapshot", async () => {
    const { wb, r } = await roundTrip(REFERENCE_CASE);
    const audit = wb.getWorksheet(SHEET_NAMES.audit)!;
    const text: string[] = [];
    audit.eachRow((row) => row.eachCell((c) => text.push(String(c.value))));
    expect(text).toContain(r.meta.engineVersion);
    expect(text.join("")).toContain(JSON.stringify(REFERENCE_CASE).slice(0, 40));
  });
});

const CHECKLIST: AuditChecklistItem[] = [
  { section: "Automatic", label: "Inputs valid", checked: true, automatic: true },
  {
    section: "Common",
    label: "Independent engineer review completed",
    checked: true,
    automatic: false,
  },
  { section: "EN 1992-1-1", label: "National Annex confirmed", checked: false, automatic: false },
];

const EC2_INPUT: PunchingShearInputEC2 = {
  VEd: 500e3,
  MEdx: 12e6,
  MEdy: 30e6,
  column: { c1: 400, c2: 400 },
  d: 200,
  slabThickness: 250,
  fck: 30,
  rhoLx: 0.01,
  rhoLy: 0.01,
  openings: [{ type: "circle", centerX: -700, centerY: 150, diameter: 150 }],
  columnLocation: "interior",
  punchingReinforcement: "none",
};

async function roundTripEC2(input: PunchingShearInputEC2) {
  const r = calculatePunchingShearEC2(input);
  if (!r.ok) throw new Error(r.reason);
  const result: PunchingShearResultEC2 = r;
  const bytes = await exportPunchingWorkbookEC2({
    project: PROJECT,
    input,
    result,
    review: null,
    checklist: CHECKLIST,
    exportedAt: new Date("2026-10-01T00:00:00Z"),
  });
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes.buffer as ArrayBuffer);
  return { wb, r };
}

describe("formatted Excel export — EN 1992-1-1", () => {
  it.each([
    ["biaxial (6.43) with an opening", EC2_INPUT],
    ["one axis, no opening", { ...EC2_INPUT, MEdx: 0, openings: [] }],
    ["concentric", { ...EC2_INPUT, MEdx: 0, MEdy: 0, openings: [] }],
    ["k uncapped (d = 300)", { ...EC2_INPUT, d: 300, slabThickness: 350, openings: [] }],
  ])("sheets and every formula reproduce the engine: %s", async (_name, input) => {
    const { wb, r } = await roundTripEC2(input as PunchingShearInputEC2);
    expect(wb.worksheets.map((w) => w.name)).toEqual(Object.values(SHEET_NAMES_EC2));
    const evaluate = evaluator(wb);
    let formulas = 0;
    for (const ws of wb.worksheets) {
      ws.eachRow((row) =>
        row.eachCell((cell) => {
          const v = cell.value as ExcelJS.CellValue;
          if (v === null || typeof v !== "object" || !("formula" in v)) return;
          formulas += 1;
          const computed = evaluate(v.formula, ws.name);
          const cached = (v as ExcelJS.CellFormulaValue).result;
          if (cached === undefined) expect(computed as number).toBeCloseTo(0, 9);
          else if (typeof cached === "number") expect(computed as number).toBeCloseTo(cached, 6);
          else expect(computed).toEqual(cached);
        }),
      );
    }
    expect(formulas).toBeGreaterThan(25);
    let dcrSeen = false;
    wb.getWorksheet(SHEET_NAMES_EC2.resistance)!.eachRow((row) => {
      if (row.getCell(2).value === "DCR") {
        dcrSeen = true;
        expect(row.getCell(4).value).toBeCloseTo(r.dcr, 12);
      }
    });
    expect(dcrSeen).toBe(true);
  });

  it("marks the module Experimental and records the checklist and engine version", async () => {
    const { wb, r } = await roundTripEC2(EC2_INPUT);
    const text: string[] = [];
    for (const ws of wb.worksheets)
      ws.eachRow((row) => row.eachCell((c) => text.push(String(c.value))));
    expect(text.some((t) => /EXPERIMENTAL/i.test(t))).toBe(true);
    expect(text).toContain(r.meta.engineVersion);
    expect(text).toContain("Independent engineer review completed");
    expect(text.some((t) => /1\/2 confirmations/i.test(t))).toBe(true);
    expect(text).toContain("✔ confirmed");
    expect(text).toContain("☐ open");
  });
});

describe("compliance checklist in the ACI workbook", () => {
  it("is written to the Audit sheet", async () => {
    const input = REFERENCE_CASE;
    const r = result(input);
    const bytes = await exportPunchingWorkbook({
      project: PROJECT,
      input,
      result: r,
      review: null,
      checklist: CHECKLIST,
      exportedAt: new Date("2026-10-01T00:00:00Z"),
    });
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(bytes.buffer as ArrayBuffer);
    const text: string[] = [];
    wb.getWorksheet(SHEET_NAMES.audit)!.eachRow((row) =>
      row.eachCell((c) => text.push(String(c.value))),
    );
    expect(text).toContain("National Annex confirmed");
    expect(text.some((t) => /confirmations/i.test(t))).toBe(true);
  });
});
