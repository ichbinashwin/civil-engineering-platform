import ExcelJS from "exceljs";
import type { Worksheet } from "exceljs";
import type { PunchingShearInput, PunchingShearResult } from "@civil/shared-types";
import { ACI318_19, convertForce, convertMoment } from "@civil/engineering-core";
import {
  BORDER_ALL,
  NUMBER_FORMATS,
  PALETTE,
  bodyCell,
  font,
  headerRow,
  safeText,
  sectionHeading,
  solid,
  statusStyle,
  titleBand,
} from "./style";

/**
 * Formatted Excel export of an ACI 318-19 punching-shear result.
 *
 * The engine is authoritative. Where practical, workbook cells hold live Excel formulas (with the
 * engine value cached as the formula result) next to an "Engine value" column and a Δ column, so a
 * reviewer can trace and cross-check each step. Opening tangent geometry and section properties
 * are engine values (not reproducible with simple worksheet formulas) and are labeled as such.
 */
export interface PunchingWorkbookParams {
  project: { name: string; member: string; engineer: string; revision: string };
  input: PunchingShearInput;
  result: PunchingShearResult;
  review?: { reviewer: string; reviewedAt: string; note: string; current: boolean } | null;
  exportedAt?: Date;
}

export const SHEET_NAMES = {
  summary: "Summary",
  inputs: "Inputs",
  geometry: "Geometry",
  punching: "Punching calculation",
  capacity: "Capacity",
  audit: "Audit",
} as const;

const KIP_TO_LB = convertForce(1, "kip", "lb");
const KIPFT_TO_LBIN = convertMoment(1, "kip-ft", "lb-in");
const JSON_CHUNK = 30000;
const TWS = ACI318_19.twoWayShear;

type CellRefs = Map<string, string>;

function absRef(sheet: string, row: number, col: number): string {
  let letters = "";
  let n = col;
  while (n > 0) {
    const m = (n - 1) % 26;
    letters = String.fromCharCode(65 + m) + letters;
    n = Math.floor((n - 1) / 26);
  }
  const quoted = /^[A-Za-z0-9_]+$/.test(sheet) ? sheet : `'${sheet}'`;
  return `${quoted}!$${letters}$${row}`;
}

function setColumns(ws: Worksheet, widths: number[]) {
  ws.columns = widths.map((width) => ({ width }));
}

/** Calculation-sheet columns: Parameter | Symbol | Excel formula | Engine value | Δ | Unit | Reference. */
const CALC_COLUMNS = [
  "Parameter",
  "Symbol",
  "Excel (formula)",
  "Engine value",
  "Δ |Excel − Engine|",
  "Unit",
  "ACI 318-19",
];

interface CalcRow {
  key: string;
  label: string;
  symbol: string;
  /** Excel formula using {key} placeholders; omit for engine-only values. */
  formula?: string;
  engine: number | string;
  unit: string;
  ref: string;
  numFmt?: string;
  emphasize?: boolean;
}

function resolveFormula(formula: string, refs: CellRefs): string {
  return formula.replace(/\{(\w+)\}/g, (_, key: string) => {
    const r = refs.get(key);
    if (!r) throw new Error(`Excel export: unknown reference {${key}}`);
    return r;
  });
}

function writeCalcTable(ws: Worksheet, startRow: number, rows: CalcRow[], refs: CellRefs): number {
  const header = ws.getRow(startRow);
  header.values = CALC_COLUMNS;
  headerRow(header);
  let r = startRow + 1;
  for (const row of rows) {
    const excel = ws.getCell(r, 3);
    const engine = ws.getCell(r, 4);
    const delta = ws.getCell(r, 5);
    ws.getCell(r, 1).value = row.label;
    ws.getCell(r, 2).value = row.symbol;
    if (row.formula) {
      excel.value = {
        formula: resolveFormula(row.formula, refs),
        result: row.engine,
      } as ExcelJS.CellFormulaValue;
    } else {
      excel.value = row.engine;
      excel.note = "Engine value (not reproducible with a worksheet formula)";
    }
    engine.value = row.engine;
    if (typeof row.engine === "number") {
      delta.value = {
        formula: `ABS(${absRef(ws.name, r, 3)}-${absRef(ws.name, r, 4)})`,
        result: 0,
      } as ExcelJS.CellFormulaValue;
    }
    ws.getCell(r, 6).value = row.unit;
    ws.getCell(r, 7).value = row.ref;

    const fill = row.emphasize ? PALETTE.blueLight : r % 2 === 0 ? PALETTE.panel : undefined;
    const fmt = row.numFmt ?? NUMBER_FORMATS.three;
    bodyCell(ws.getCell(r, 1), { bold: row.emphasize ?? false, ...(fill ? { fill } : {}) });
    bodyCell(ws.getCell(r, 2), { align: "center", ...(fill ? { fill } : {}) });
    bodyCell(excel, {
      numFmt: fmt,
      align: "right",
      bold: row.emphasize ?? false,
      fill: row.formula ? "FFFFFDF2" : (fill ?? PALETTE.white),
    });
    bodyCell(engine, {
      numFmt: fmt,
      align: "right",
      bold: row.emphasize ?? false,
      ...(fill ? { fill } : {}),
    });
    bodyCell(delta, { numFmt: NUMBER_FORMATS.delta, align: "right", ...(fill ? { fill } : {}) });
    bodyCell(ws.getCell(r, 6), { align: "center", ...(fill ? { fill } : {}) });
    bodyCell(ws.getCell(r, 7), { align: "center", ...(fill ? { fill } : {}) });
    ws.getCell(r, 7).font = font({ color: { argb: PALETTE.muted }, size: 9 });
    refs.set(row.key, absRef(ws.name, r, 3));
    r += 1;
  }
  return r;
}

function noteRow(ws: Worksheet, row: number, text: string, columns: number) {
  ws.mergeCells(row, 1, row, columns);
  const c = ws.getCell(row, 1);
  c.value = text;
  c.font = font({ size: 9, italic: true, color: { argb: PALETTE.muted } });
  c.alignment = { wrapText: true, vertical: "top" };
  ws.getRow(row).height = 30;
}

function prepareSheet(ws: Worksheet, landscape = false) {
  ws.pageSetup = {
    paperSize: 9,
    orientation: landscape ? "landscape" : "portrait",
    fitToPage: true,
    fitToWidth: 1,
    fitToHeight: 0,
    margins: { left: 0.5, right: 0.5, top: 0.6, bottom: 0.6, header: 0.3, footer: 0.3 },
  };
  ws.headerFooter = { oddFooter: "&L&8ACI 318-19 Punching Shear&C&8Page &P of &N&R&8&A" };
  ws.properties.defaultRowHeight = 16;
}

// ── Inputs ────────────────────────────────────────────────────────────────────
function buildInputs(wb: ExcelJS.Workbook, p: PunchingWorkbookParams, refs: CellRefs) {
  const ws = wb.addWorksheet(SHEET_NAMES.inputs, { views: [{ state: "frozen", ySplit: 4 }] });
  prepareSheet(ws);
  setColumns(ws, [34, 10, 16, 10, 46]);
  titleBand(
    ws,
    "Design inputs",
    "Values as entered (display units). Engine works internally in lb, in, lb-in, psi.",
    5,
  );
  const { input } = p;
  const header = ws.getRow(4);
  header.values = ["Parameter", "Symbol", "Value", "Unit", "Note"];
  headerRow(header);

  const rows: [
    key: string,
    label: string,
    symbol: string,
    value: number | string | boolean,
    unit: string,
    note: string,
    fmt?: string,
  ][] = [
    [
      "Vu",
      "Factored shear",
      "Vu",
      convertForce(input.Vu, "lb", "kip"),
      "kip",
      "Factored load combination",
    ],
    [
      "Mux",
      "Unbalanced moment about X",
      "Mux",
      convertMoment(input.Mux, "lb-in", "kip-ft"),
      "kip-ft",
      "Stress varies with y",
    ],
    [
      "Muy",
      "Unbalanced moment about Y",
      "Muy",
      convertMoment(input.Muy, "lb-in", "kip-ft"),
      "kip-ft",
      "Stress varies with x",
    ],
    ["c1", "Column dimension along X", "c1", input.column.c1, "in", ""],
    ["c2", "Column dimension along Y", "c2", input.column.c2, "in", ""],
    ["d", "Effective depth", "d", input.d, "in", ""],
    ["h", "Slab thickness", "h", input.slabThickness, "in", "Used for 4h opening check"],
    ["fc", "Specified concrete strength", "f'c", input.concrete.fc, "psi", ""],
    [
      "lambda",
      "Lightweight concrete factor",
      "λ",
      input.concrete.lambda,
      "—",
      "1.0 = normal weight",
    ],
    ["location", "Column location", "", input.columnLocation, "", "αs per Table 22.6.5.2"],
    ["reinforcement", "Shear reinforcement", "", input.punchingReinforcement, "", ""],
    [
      "applySE",
      "Apply size-effect factor λs",
      "",
      input.options?.applySizeEffectFactor ?? true,
      "",
      "§22.5.5.1.3; FALSE = non-conforming legacy option",
    ],
  ];
  let r = 5;
  for (const [key, label, symbol, value, unit, note, fmt] of rows) {
    ws.getRow(r).values = [
      label,
      symbol,
      typeof value === "string" ? safeText(value) : value,
      unit,
      note,
    ];
    const fill = r % 2 === 0 ? PALETTE.panel : undefined;
    bodyCell(ws.getCell(r, 1), fill ? { fill } : {});
    bodyCell(ws.getCell(r, 2), { align: "center", ...(fill ? { fill } : {}) });
    bodyCell(ws.getCell(r, 3), {
      align: "right",
      numFmt: fmt ?? "General",
      bold: true,
      fill: "FFFFFDF2",
    });
    bodyCell(ws.getCell(r, 4), { align: "center", ...(fill ? { fill } : {}) });
    bodyCell(ws.getCell(r, 5), fill ? { fill } : {});
    refs.set(key, absRef(ws.name, r, 3));
    r += 1;
  }

  r += 1;
  sectionHeading(ws, r, "Openings (coordinates from column centroid)", 5);
  r += 1;
  const oh = ws.getRow(r);
  oh.values = ["Opening", "Type", "Center X (in)", "Center Y (in)", "Size (in)"];
  headerRow(oh);
  r += 1;
  if (input.openings.length === 0) {
    ws.getCell(r, 1).value = "None";
    bodyCell(ws.getCell(r, 1));
    r += 1;
  }
  input.openings.forEach((o, i) => {
    const size = o.type === "circle" ? `Ø ${o.diameter}` : `${o.width} × ${o.height}`;
    ws.getRow(r).values = [`O${i + 1}`, o.type, o.centerX, o.centerY, size];
    [1, 2, 3, 4, 5].forEach((c) =>
      bodyCell(ws.getCell(r, c), { align: c >= 3 ? "right" : "left", numFmt: NUMBER_FORMATS.two }),
    );
    r += 1;
  });
}

// ── Geometry ──────────────────────────────────────────────────────────────────
function buildGeometry(wb: ExcelJS.Workbook, p: PunchingWorkbookParams, refs: CellRefs) {
  const ws = wb.addWorksheet(SHEET_NAMES.geometry, { views: [{ state: "frozen", ySplit: 4 }] });
  prepareSheet(ws, true);
  setColumns(ws, [36, 10, 16, 16, 14, 8, 14]);
  titleBand(
    ws,
    "Critical section geometry",
    "§22.6.4.1 critical section at d/2; §22.6.4.3 opening reductions by tangent lines from the column centroid.",
    7,
  );
  const g = p.result.geometry;
  const reductions = g.openingReductions.map((o) => o.reduction);
  const sumOfReductions = reductions.reduce((a, b) => a + b, 0);
  // Overlapping shadows are merged by the engine; only then is "gross − Σ reductions" exact.
  const additive = Math.abs(g.grossPerimeter - sumOfReductions - g.effectivePerimeter) < 1e-9;

  const rows: CalcRow[] = [
    {
      key: "sizeX",
      label: "Critical section size along X",
      symbol: "c1 + d",
      formula: "{c1}+{d}",
      engine: g.sizeX,
      unit: "in",
      ref: "22.6.4.1",
    },
    {
      key: "sizeY",
      label: "Critical section size along Y",
      symbol: "c2 + d",
      formula: "{c2}+{d}",
      engine: g.sizeY,
      unit: "in",
      ref: "22.6.4.1",
    },
    {
      key: "boGross",
      label: "Gross perimeter",
      symbol: "bo",
      formula: "2*({sizeX}+{sizeY})",
      engine: g.grossPerimeter,
      unit: "in",
      ref: "22.6.4.1",
    },
    ...g.openingReductions.map((o): CalcRow => ({
      key: `red${o.openingIndex}`,
      label: `Opening O${o.openingIndex + 1} ineffective length`,
      symbol: `ΔbO${o.openingIndex + 1}`,
      engine: o.reduction,
      unit: "in",
      ref: "22.6.4.3",
    })),
    {
      key: "bo",
      label: "Effective perimeter",
      symbol: "bo,eff",
      ...(additive
        ? {
            formula: [
              "{boGross}",
              ...g.openingReductions.map((o) => `{red${o.openingIndex}}`),
            ].join("-"),
          }
        : {}),
      engine: g.effectivePerimeter,
      unit: "in",
      ref: "22.6.4.3",
      emphasize: true,
    },
    {
      key: "xc",
      label: "Centroid of effective section, x",
      symbol: "x̄",
      engine: g.centroidX,
      unit: "in",
      ref: "R8.4.4.2.3",
      numFmt: NUMBER_FORMATS.four,
    },
    {
      key: "yc",
      label: "Centroid of effective section, y",
      symbol: "ȳ",
      engine: g.centroidY,
      unit: "in",
      ref: "R8.4.4.2.3",
      numFmt: NUMBER_FORMATS.four,
    },
    {
      key: "Ix",
      label: "Line second moment about x",
      symbol: "Ix",
      engine: g.Ix,
      unit: "in³",
      ref: "",
      numFmt: NUMBER_FORMATS.one,
    },
    {
      key: "Iy",
      label: "Line second moment about y",
      symbol: "Iy",
      engine: g.Iy,
      unit: "in³",
      ref: "",
      numFmt: NUMBER_FORMATS.one,
    },
    {
      key: "Jx",
      label: "Polar property for Mux",
      symbol: "Jx",
      engine: g.Jx,
      unit: "in⁴",
      ref: "R8.4.4.2.3",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "Jy",
      label: "Polar property for Muy",
      symbol: "Jy",
      engine: g.Jy,
      unit: "in⁴",
      ref: "R8.4.4.2.3",
      numFmt: NUMBER_FORMATS.integer,
    },
  ];
  const end = writeCalcTable(ws, 4, rows, refs);
  noteRow(
    ws,
    end + 1,
    "Yellow cells are live Excel formulas referencing the Inputs sheet. White 'Excel' cells are engine values: tangent-line geometry and effective-section properties (generalized Jc incl. d³ terms) are computed by the engine and cannot be reproduced with simple worksheet formulas." +
      (additive ? "" : " Opening shadows overlap, so bo,eff is not a simple subtraction."),
    7,
  );

  sectionHeading(ws, end + 3, "Effective perimeter segments", 7);
  const sh = ws.getRow(end + 4);
  sh.values = ["Segment", "x1 (in)", "y1 (in)", "x2 (in)", "y2 (in)", "", "Length (in)"];
  headerRow(sh);
  let r = end + 5;
  g.segments.forEach((s, i) => {
    ws.getRow(r).values = [
      `S${i + 1}`,
      s.x1,
      s.y1,
      s.x2,
      s.y2,
      "",
      Math.hypot(s.x2 - s.x1, s.y2 - s.y1),
    ];
    for (let c = 1; c <= 7; c++)
      bodyCell(ws.getCell(r, c), {
        align: c === 1 ? "left" : "right",
        numFmt: NUMBER_FORMATS.three,
      });
    r += 1;
  });
}

// ── Punching calculation (demand) ─────────────────────────────────────────────
function buildPunching(wb: ExcelJS.Workbook, p: PunchingWorkbookParams, refs: CellRefs) {
  const ws = wb.addWorksheet(SHEET_NAMES.punching, { views: [{ state: "frozen", ySplit: 4 }] });
  prepareSheet(ws, true);
  setColumns(ws, [36, 12, 16, 16, 14, 8, 14]);
  titleBand(
    ws,
    "Punching shear demand",
    "vu = Vu/(bo d) + γvx|Mux||y − ȳ|/Jx + γvy|Muy||x − x̄|/Jy at the critical point (sign envelope) — §8.4.4.2",
    7,
  );
  const dm = p.result.demand;
  const k = ACI318_19.momentTransfer.gammaFCoefficient;
  const rows: CalcRow[] = [
    {
      key: "gvx",
      label: "Moment fraction by shear for Mux (b1 = c2 + d)",
      symbol: "γvx",
      formula: `1-1/(1+${k}*SQRT({sizeY}/{sizeX}))`,
      engine: dm.gammaVx,
      unit: "—",
      ref: "8.4.2.2",
      numFmt: NUMBER_FORMATS.four,
    },
    {
      key: "gvy",
      label: "Moment fraction by shear for Muy (b1 = c1 + d)",
      symbol: "γvy",
      formula: `1-1/(1+${k}*SQRT({sizeX}/{sizeY}))`,
      engine: dm.gammaVy,
      unit: "—",
      ref: "8.4.2.2",
      numFmt: NUMBER_FORMATS.four,
    },
    {
      key: "VuLb",
      label: "Factored shear",
      symbol: "Vu",
      formula: `{Vu}*${KIP_TO_LB}`,
      engine: p.input.Vu,
      unit: "lb",
      ref: "",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "MuxLbIn",
      label: "Unbalanced moment about X",
      symbol: "Mux",
      formula: `{Mux}*${KIPFT_TO_LBIN}`,
      engine: p.input.Mux,
      unit: "lb-in",
      ref: "",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "MuyLbIn",
      label: "Unbalanced moment about Y",
      symbol: "Muy",
      formula: `{Muy}*${KIPFT_TO_LBIN}`,
      engine: p.input.Muy,
      unit: "lb-in",
      ref: "",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "vuv",
      label: "Direct shear stress",
      symbol: "vuv",
      formula: "{VuLb}/({bo}*{d})",
      engine: dm.directShear,
      unit: "psi",
      ref: "8.4.4.2",
      numFmt: NUMBER_FORMATS.two,
    },
    {
      key: "xcrit",
      label: "Critical point x",
      symbol: "xcr",
      engine: dm.criticalPoint.x,
      unit: "in",
      ref: "",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "ycrit",
      label: "Critical point y",
      symbol: "ycr",
      engine: dm.criticalPoint.y,
      unit: "in",
      ref: "",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "vux",
      label: "Shear stress from Mux",
      symbol: "vux",
      formula: "{gvx}*ABS({MuxLbIn})*ABS({ycrit}-{yc})/{Jx}",
      engine: dm.momentX,
      unit: "psi",
      ref: "8.4.4.2",
      numFmt: NUMBER_FORMATS.two,
    },
    {
      key: "vuy",
      label: "Shear stress from Muy",
      symbol: "vuy",
      formula: "{gvy}*ABS({MuyLbIn})*ABS({xcrit}-{xc})/{Jy}",
      engine: dm.momentY,
      unit: "psi",
      ref: "8.4.4.2",
      numFmt: NUMBER_FORMATS.two,
    },
    {
      key: "vumax",
      label: "Maximum factored shear stress",
      symbol: "vu,max",
      formula: "{vuv}+{vux}+{vuy}",
      engine: dm.maximumShearStress,
      unit: "psi",
      ref: "8.4.4.2",
      numFmt: NUMBER_FORMATS.two,
      emphasize: true,
    },
  ];
  const end = writeCalcTable(ws, 4, rows, refs);

  sectionHeading(ws, end + 1, "Calculation trace (engine)", 7);
  const th = ws.getRow(end + 2);
  th.values = ["Step", "Formula", "Substitution", "", "Result", "Unit", "ACI 318-19"];
  headerRow(th);
  ws.mergeCells(end + 2, 3, end + 2, 4);
  let r = end + 3;
  p.result.steps.forEach((s, i) => {
    ws.getRow(r).values = [
      `${i + 1}. ${s.title}`,
      s.formula,
      s.substitution,
      "",
      s.value,
      s.unit,
      s.reference ? s.reference.section : "",
    ];
    ws.mergeCells(r, 3, r, 4);
    for (let c = 1; c <= 7; c++)
      bodyCell(ws.getCell(r, c), {
        align: c === 5 ? "right" : c >= 6 ? "center" : "left",
        numFmt: NUMBER_FORMATS.three,
      });
    ws.getCell(r, 2).font = font({ name: "Consolas", size: 9 });
    ws.getCell(r, 3).font = font({ name: "Consolas", size: 9, color: { argb: PALETTE.muted } });
    ws.getRow(r).height = 30;
    r += 1;
  });
}

// ── Capacity ──────────────────────────────────────────────────────────────────
function buildCapacity(wb: ExcelJS.Workbook, p: PunchingWorkbookParams, refs: CellRefs) {
  const ws = wb.addWorksheet(SHEET_NAMES.capacity, { views: [{ state: "frozen", ySplit: 4 }] });
  prepareSheet(ws, true);
  setColumns(ws, [36, 12, 16, 16, 14, 8, 14]);
  titleBand(
    ws,
    "Concrete two-way shear strength",
    "ACI 318-19 Table 22.6.5.2 — no shear reinforcement; φ per Table 21.2.1",
    7,
  );
  const c = p.result.capacity;
  const se = ACI318_19.sizeEffect;
  const rows: CalcRow[] = [
    {
      key: "lambdaS",
      label: "Size-effect factor",
      symbol: "λs",
      formula: `IF({applySE},MIN(${se.maximum},SQRT(${se.numerator}/(1+{d}/${se.referenceDepthIn}))),1)`,
      engine: c.lambdaS,
      unit: "—",
      ref: "22.5.5.1.3",
      numFmt: NUMBER_FORMATS.four,
    },
    {
      key: "lam",
      label: "Lightweight factor",
      symbol: "λ",
      formula: "{lambda}",
      engine: c.lambda,
      unit: "—",
      ref: "",
      numFmt: NUMBER_FORMATS.two,
    },
    {
      key: "sqrtFc",
      label: "√f'c (limited)",
      symbol: "√f'c",
      formula: `MIN(SQRT({fc}),${TWS.sqrtFcLimitPsi})`,
      engine: c.sqrtFc,
      unit: "psi",
      ref: "22.6.3.1",
      numFmt: NUMBER_FORMATS.two,
    },
    {
      key: "beta",
      label: "Column aspect ratio (long/short)",
      symbol: "β",
      formula: "MAX({c1},{c2})/MIN({c1},{c2})",
      engine: c.betaC,
      unit: "—",
      ref: "22.6.5.2",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "alphaS",
      label: `αs (${p.input.columnLocation} column)`,
      symbol: "αs",
      engine: c.alphaS,
      unit: "—",
      ref: "22.6.5.2",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "vcA",
      label: "vc (a) = 4 λs λ √f'c",
      symbol: "vc(a)",
      formula: `${TWS.vcCoefficientA}*{lambdaS}*{lam}*{sqrtFc}`,
      engine: c.vcA,
      unit: "psi",
      ref: "22.6.5.2(a)",
      numFmt: NUMBER_FORMATS.one,
      emphasize: c.governingEquation === "a",
    },
    {
      key: "vcB",
      label: "vc (b) = (2 + 4/β) λs λ √f'c",
      symbol: "vc(b)",
      formula: `(${TWS.vcCoefficientBConstant}+${TWS.vcCoefficientBBeta}/{beta})*{lambdaS}*{lam}*{sqrtFc}`,
      engine: c.vcB,
      unit: "psi",
      ref: "22.6.5.2(b)",
      numFmt: NUMBER_FORMATS.one,
      emphasize: c.governingEquation === "b",
    },
    {
      key: "vcC",
      label: "vc (c) = (2 + αs d/bo) λs λ √f'c",
      symbol: "vc(c)",
      formula: `(${TWS.vcCoefficientCConstant}+{alphaS}*{d}/{bo})*{lambdaS}*{lam}*{sqrtFc}`,
      engine: c.vcC,
      unit: "psi",
      ref: "22.6.5.2(c)",
      numFmt: NUMBER_FORMATS.one,
      emphasize: c.governingEquation === "c",
    },
    {
      key: "vc",
      label: "Governing vc (least)",
      symbol: "vc",
      formula: "MIN({vcA},{vcB},{vcC})",
      engine: c.governingVc,
      unit: "psi",
      ref: "22.6.5.2",
      numFmt: NUMBER_FORMATS.one,
    },
    {
      key: "phi",
      label: "Strength reduction factor (shear)",
      symbol: "φ",
      engine: c.phi,
      unit: "—",
      ref: "21.2.1",
      numFmt: NUMBER_FORMATS.two,
    },
    {
      key: "phiVc",
      label: "Design shear stress strength",
      symbol: "φvc",
      formula: "{phi}*{vc}",
      engine: c.designStrength,
      unit: "psi",
      ref: "22.6",
      numFmt: NUMBER_FORMATS.one,
      emphasize: true,
    },
    {
      key: "dcr",
      label: "Demand / capacity ratio",
      symbol: "DCR",
      formula: "{vumax}/{phiVc}",
      engine: p.result.dcr,
      unit: "—",
      ref: "22.6",
      numFmt: NUMBER_FORMATS.three,
      emphasize: true,
    },
    {
      key: "status",
      label: "Status (DCR ≤ 1.00 → PASS)",
      symbol: "",
      formula: 'IF({dcr}<=1,"PASS","FAIL")',
      engine: p.result.status,
      unit: "",
      ref: "",
      emphasize: true,
    },
  ];
  const end = writeCalcTable(ws, 4, rows, refs);
  const statusRow = end - 1;
  statusStyle(ws.getCell(statusRow, 3), p.result.status);
  statusStyle(ws.getCell(statusRow, 4), p.result.status);
  noteRow(
    ws,
    end + 1,
    `Governing: ${p.result.governingCheck}. Engine values are authoritative; Δ should be ≈ 0 after Excel recalculates.`,
    7,
  );
}

// ── Summary ───────────────────────────────────────────────────────────────────
function buildSummary(wb: ExcelJS.Workbook, p: PunchingWorkbookParams, refs: CellRefs) {
  const ws = wb.getWorksheet(SHEET_NAMES.summary);
  if (!ws) return;
  prepareSheet(ws);
  setColumns(ws, [30, 22, 4, 30, 22]);
  titleBand(
    ws,
    "ACI 318-19 Two-Way Punching Shear — Summary",
    `${safeText(p.project.name || "Untitled project")} · ${safeText(p.project.member || "Member")} · Rev ${safeText(p.project.revision || "0")}`,
    5,
  );
  const { result } = p;

  // Big result block.
  ws.mergeCells("A4:B4");
  ws.getCell("A4").value = "DEMAND / CAPACITY RATIO";
  ws.getCell("A4").font = font({ size: 9, bold: true, color: { argb: PALETTE.muted } });
  ws.mergeCells("A5:B7");
  const dcr = ws.getCell("A5");
  dcr.value = {
    formula: resolveFormula("{dcr}", refs),
    result: result.dcr,
  } as ExcelJS.CellFormulaValue;
  dcr.numFmt = NUMBER_FORMATS.three;
  dcr.font = font({ size: 36, bold: true, name: "Consolas" });
  dcr.alignment = { horizontal: "center", vertical: "middle" };
  dcr.fill = solid(result.status === "PASS" ? PALETTE.greenBg : PALETTE.redBg);
  ws.mergeCells("A8:B8");
  const st = ws.getCell("A8");
  st.value = {
    formula: resolveFormula("{status}", refs),
    result: result.status,
  } as ExcelJS.CellFormulaValue;
  statusStyle(st, result.status);
  ws.getRow(8).height = 24;

  const kv: [string, ExcelJS.CellValue, string?][] = [
    ["Project", safeText(p.project.name)],
    ["Member", safeText(p.project.member)],
    ["Engineer", safeText(p.project.engineer || "—")],
    ["Revision", safeText(p.project.revision)],
    ["Design code", result.meta.designCode],
    ["Governing check", result.governingCheck],
  ];
  kv.forEach(([k, v], i) => {
    const r = 4 + i;
    ws.getCell(r, 4).value = k;
    ws.getCell(r, 5).value = v;
    bodyCell(ws.getCell(r, 4), { fill: PALETTE.panel, bold: true });
    bodyCell(ws.getCell(r, 5));
  });

  sectionHeading(ws, 11, "Key results", 5);
  const head = ws.getRow(12);
  head.values = ["Quantity", "Value", "", "Unit", "Reference"];
  headerRow(head);
  const keyRows: [string, string, number, string, string, string][] = [
    [
      "Effective perimeter bo",
      "bo",
      result.geometry.effectivePerimeter,
      "in",
      "§22.6.4.3",
      NUMBER_FORMATS.three,
    ],
    [
      "Maximum factored shear stress vu,max",
      "vumax",
      result.demand.maximumShearStress,
      "psi",
      "§8.4.4.2",
      NUMBER_FORMATS.one,
    ],
    [
      "Concrete shear strength vc",
      "vc",
      result.capacity.governingVc,
      "psi",
      "Table 22.6.5.2",
      NUMBER_FORMATS.one,
    ],
    [
      "Design strength φvc",
      "phiVc",
      result.capacity.designStrength,
      "psi",
      "§22.6",
      NUMBER_FORMATS.one,
    ],
    [
      "Size-effect factor λs",
      "lambdaS",
      result.capacity.lambdaS,
      "—",
      "§22.5.5.1.3",
      NUMBER_FORMATS.three,
    ],
    ["DCR", "dcr", result.dcr, "—", "", NUMBER_FORMATS.three],
  ];
  keyRows.forEach(([label, key, value, unit, ref, fmt], i) => {
    const r = 13 + i;
    ws.getCell(r, 1).value = label;
    ws.getCell(r, 2).value = {
      formula: resolveFormula(`{${key}}`, refs),
      result: value,
    } as ExcelJS.CellFormulaValue;
    ws.getCell(r, 4).value = unit;
    ws.getCell(r, 5).value = ref;
    bodyCell(ws.getCell(r, 1));
    bodyCell(ws.getCell(r, 2), { align: "right", numFmt: fmt, bold: true });
    bodyCell(ws.getCell(r, 3));
    bodyCell(ws.getCell(r, 4), { align: "center" });
    bodyCell(ws.getCell(r, 5), { align: "center" });
  });

  let r = 13 + keyRows.length + 1;
  sectionHeading(ws, r, `Engineering messages (${result.warnings.length})`, 5);
  r += 1;
  if (result.warnings.length === 0) {
    ws.getCell(r, 1).value = "None";
    r += 1;
  }
  for (const w of result.warnings) {
    ws.getCell(r, 1).value = w.severity;
    const sev = ws.getCell(r, 1);
    sev.font = font({
      bold: true,
      color: {
        argb:
          w.severity === "ERROR"
            ? PALETTE.red
            : w.severity === "WARNING"
              ? PALETTE.amber
              : PALETTE.blue,
      },
    });
    sev.fill = solid(
      w.severity === "ERROR"
        ? PALETTE.redBg
        : w.severity === "WARNING"
          ? PALETTE.amberBg
          : PALETTE.blueLight,
    );
    sev.border = BORDER_ALL;
    ws.mergeCells(r, 2, r, 5);
    const msg = ws.getCell(r, 2);
    msg.value = safeText(w.message);
    bodyCell(msg);
    ws.getRow(r).height = Math.max(18, Math.ceil(w.message.length / 90) * 14);
    r += 1;
  }

  r += 1;
  sectionHeading(ws, r, "Engineer review", 5);
  r += 1;
  const review = p.review;
  ws.mergeCells(r, 1, r, 5);
  ws.getCell(r, 1).value = review
    ? safeText(
        `${review.current ? "Reviewed" : "Review OUTDATED (inputs changed after review)"} — ${review.reviewer}, ${new Date(review.reviewedAt).toISOString()}${review.note ? ` — ${review.note}` : ""}`,
      )
    : "Not reviewed (draft).";
  ws.getCell(r, 1).font = font({
    bold: true,
    color: { argb: review?.current ? PALETTE.green : PALETTE.amber },
  });

  r += 2;
  ws.mergeCells(r, 1, r + 2, 5);
  const disc = ws.getCell(r, 1);
  disc.value =
    "Engineering disclaimer: results require review by a qualified engineer. Confirm code applicability and project-specific conditions; additional checks may be required. This software does not replace professional engineering judgment. Independently review calculations before issuing construction documents.";
  disc.font = font({ size: 9, italic: true, color: { argb: PALETTE.muted } });
  disc.alignment = { wrapText: true, vertical: "top" };
  disc.fill = solid(PALETTE.panel);
}

// ── Audit ─────────────────────────────────────────────────────────────────────
function buildAudit(wb: ExcelJS.Workbook, p: PunchingWorkbookParams, exportedAt: Date) {
  const ws = wb.addWorksheet(SHEET_NAMES.audit);
  prepareSheet(ws, true);
  setColumns(ws, [28, 14, 90]);
  titleBand(
    ws,
    "Audit record",
    "Reproduce this calculation by re-running the engine version below with the input snapshot.",
    3,
  );
  const { result } = p;
  const meta: [string, string][] = [
    ["Exported at (UTC)", exportedAt.toISOString()],
    ["Module", result.meta.module],
    ["Design code / edition", result.meta.designCode],
    ["Engine version", result.meta.engineVersion],
    ["Project", safeText(p.project.name)],
    ["Member", safeText(p.project.member)],
    ["Revision", safeText(p.project.revision)],
    ["Engineer", safeText(p.project.engineer || "—")],
    ["Status / DCR", `${result.status} / ${result.dcr.toFixed(4)}`],
    ["Method", result.meta.method],
  ];
  let r = 4;
  for (const [k, v] of meta) {
    ws.getCell(r, 1).value = k;
    ws.mergeCells(r, 2, r, 3);
    ws.getCell(r, 2).value = v;
    bodyCell(ws.getCell(r, 1), { bold: true, fill: PALETTE.panel });
    bodyCell(ws.getCell(r, 2));
    if (k === "Method") ws.getRow(r).height = 60;
    r += 1;
  }

  r += 1;
  sectionHeading(ws, r, "Code references", 3);
  r += 1;
  const ch = ws.getRow(r);
  ch.values = ["Code", "Section", "Description"];
  headerRow(ch);
  r += 1;
  for (const ref of result.codeReferences) {
    ws.getRow(r).values = [`${ref.code}-${ref.edition}`, ref.section, ref.description];
    [1, 2, 3].forEach((c) => bodyCell(ws.getCell(r, c), { align: c === 2 ? "center" : "left" }));
    r += 1;
  }

  r += 1;
  sectionHeading(ws, r, "Warnings", 3);
  r += 1;
  const wh = ws.getRow(r);
  wh.values = ["Severity", "Code", "Message"];
  headerRow(wh);
  r += 1;
  for (const w of result.warnings) {
    ws.getRow(r).values = [w.severity, w.code, safeText(w.message)];
    [1, 2, 3].forEach((c) => bodyCell(ws.getCell(r, c)));
    r += 1;
  }

  r += 1;
  sectionHeading(ws, r, "Input snapshot (canonical units: lb, in, lb-in, psi) — JSON", 3);
  r += 1;
  const json = JSON.stringify(p.input);
  for (let i = 0; i < json.length; i += JSON_CHUNK) {
    ws.mergeCells(r, 1, r, 3);
    const cell = ws.getCell(r, 1);
    cell.value = json.slice(i, i + JSON_CHUNK);
    cell.font = font({ name: "Consolas", size: 8 });
    cell.alignment = { wrapText: true, vertical: "top" };
    ws.getRow(r).height = Math.min(
      400,
      Math.ceil(Math.min(json.length - i, JSON_CHUNK) / 160) * 12 + 12,
    );
    r += 1;
  }
}

/** Builds the formatted workbook. Throws only on programming errors (unknown references). */
export function buildPunchingWorkbook(params: PunchingWorkbookParams): ExcelJS.Workbook {
  const exportedAt = params.exportedAt ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Civil Engineering Platform";
  wb.created = exportedAt;
  wb.modified = exportedAt;
  wb.title = `Punching shear — ${params.project.member}`;
  wb.calcProperties = { fullCalcOnLoad: true };

  const refs: CellRefs = new Map();
  // Summary is first in tab order but filled last (it references the other sheets).
  wb.addWorksheet(SHEET_NAMES.summary, { properties: { tabColor: { argb: PALETTE.blue } } });
  buildInputs(wb, params, refs);
  buildGeometry(wb, params, refs);
  buildPunching(wb, params, refs);
  buildCapacity(wb, params, refs);
  buildSummary(wb, params, refs);
  buildAudit(wb, params, exportedAt);
  return wb;
}

export async function exportPunchingWorkbook(params: PunchingWorkbookParams): Promise<Uint8Array> {
  const buffer = await buildPunchingWorkbook(params).xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
