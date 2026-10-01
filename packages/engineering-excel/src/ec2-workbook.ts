import ExcelJS from "exceljs";
import type { PunchingShearInputEC2, PunchingShearResultEC2 } from "@civil/shared-types";
import { EN1992_1_1, convertForce, convertMoment } from "@civil/engineering-core";
import { writeChecklistSection } from "./audit-checklist";
import type { AuditChecklistItem } from "./audit-checklist";
import {
  CALC_COLUMNS,
  JSON_CHUNK,
  absRef,
  noteRow,
  prepareSheet,
  resolveFormula,
  setColumns,
  writeCalcTable,
} from "./punching-workbook";
import type { CalcRow, CellRefs } from "./punching-workbook";
import {
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
 * Formatted Excel export of an EN 1992-1-1 punching-shear result (Experimental).
 *
 * The engine is authoritative. Closed-form steps are live Excel formulas (engine value cached, Δ column);
 * the rounded control perimeter, opening tangents, W1 of a reduced perimeter and the Table 6.1 lookup are
 * engine values and are labelled so. Units follow the form: kN, kN·m, mm, MPa.
 */
export interface PunchingWorkbookEC2Params {
  project: { name: string; member: string; engineer: string; revision: string };
  input: PunchingShearInputEC2;
  result: PunchingShearResultEC2;
  review?: { reviewer: string; reviewedAt: string; note: string; current: boolean } | null;
  checklist?: AuditChecklistItem[];
  exportedAt?: Date;
}

export const SHEET_NAMES_EC2 = {
  summary: "Summary",
  inputs: "Inputs",
  geometry: "Control perimeter",
  demand: "Demand",
  resistance: "Resistance",
  audit: "Audit",
} as const;

const P = EN1992_1_1.punching;
const KN_TO_N = convertForce(1, "kN", "N");
const KNM_TO_NMM = convertMoment(1, "kN-m", "N-mm");

function buildInputs(wb: ExcelJS.Workbook, p: PunchingWorkbookEC2Params, refs: CellRefs) {
  const ws = wb.addWorksheet(SHEET_NAMES_EC2.inputs, { views: [{ state: "frozen", ySplit: 4 }] });
  prepareSheet(ws);
  setColumns(ws, [34, 10, 16, 10, 46]);
  titleBand(
    ws,
    "Design inputs (EN 1992-1-1)",
    "Values as entered (kN, kN·m, mm, MPa). Engine works internally in N, N·mm, mm, MPa.",
    5,
  );
  const { input } = p;
  const header = ws.getRow(4);
  header.values = ["Parameter", "Symbol", "Value", "Unit", "Note"];
  headerRow(header);
  const rows: [string, string, string, number | string, string, string][] = [
    [
      "VEd",
      "Design shear force",
      "VEd",
      convertForce(input.VEd, "N", "kN"),
      "kN",
      "Design value of the punching load",
    ],
    [
      "MEdx",
      "Unbalanced moment about X",
      "MEdx",
      convertMoment(input.MEdx, "N-mm", "kN-m"),
      "kN·m",
      "Eccentricity along Y",
    ],
    [
      "MEdy",
      "Unbalanced moment about Y",
      "MEdy",
      convertMoment(input.MEdy, "N-mm", "kN-m"),
      "kN·m",
      "Eccentricity along X",
    ],
    ["c1", "Column dimension along X", "c1", input.column.c1, "mm", ""],
    ["c2", "Column dimension along Y", "c2", input.column.c2, "mm", ""],
    ["d", "Mean effective depth", "d", input.d, "mm", "(dy + dz)/2, §6.4.2(1)"],
    ["h", "Slab thickness", "h", input.slabThickness, "mm", ""],
    ["fck", "Characteristic cylinder strength", "fck", input.fck, "MPa", "C12/15 … C90/105"],
    [
      "rhoX",
      "Tension reinforcement ratio, X",
      "ρlx",
      input.rhoLx * 100,
      "%",
      "Mean over c + 3d each side",
    ],
    [
      "rhoY",
      "Tension reinforcement ratio, Y",
      "ρly",
      input.rhoLy * 100,
      "%",
      "Mean over c + 3d each side",
    ],
    ["location", "Column location", "", input.columnLocation, "", ""],
    ["reinforcement", "Shear reinforcement", "", input.punchingReinforcement, "", ""],
  ];
  let r = 5;
  for (const [key, label, symbol, value, unit, note] of rows) {
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
    bodyCell(ws.getCell(r, 3), { align: "right", bold: true, fill: "FFFFFDF2", numFmt: "General" });
    bodyCell(ws.getCell(r, 4), { align: "center", ...(fill ? { fill } : {}) });
    bodyCell(ws.getCell(r, 5), fill ? { fill } : {});
    refs.set(key, absRef(ws.name, r, 3));
    r += 1;
  }
  r += 1;
  sectionHeading(ws, r, "Openings (coordinates from column centroid, mm)", 5);
  r += 1;
  const oh = ws.getRow(r);
  oh.values = ["Opening", "Type", "Center X (mm)", "Center Y (mm)", "Size (mm)"];
  headerRow(oh);
  r += 1;
  if (input.openings.length === 0) {
    ws.getCell(r, 1).value = "None";
    bodyCell(ws.getCell(r, 1));
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

function buildGeometry(wb: ExcelJS.Workbook, p: PunchingWorkbookEC2Params, refs: CellRefs) {
  const ws = wb.addWorksheet(SHEET_NAMES_EC2.geometry, { views: [{ state: "frozen", ySplit: 4 }] });
  prepareSheet(ws, true);
  setColumns(ws, [38, 12, 18, 16, 14, 8, 16]);
  titleBand(
    ws,
    "Basic control perimeter",
    "§6.4.2(1) at 2.0d with rounded corners; §6.4.2(3) openings within 6d removed between tangents.",
    7,
  );
  const g = p.result.geometry;
  const additive =
    Math.abs(
      g.grossPerimeter -
        g.openingReductions.reduce((s, o) => s + o.reduction, 0) -
        g.effectivePerimeter,
    ) < 1e-6;
  const rows: CalcRow[] = [
    {
      key: "by",
      label: "Control perimeter dimension along X",
      symbol: "by",
      formula: `{c1}+2*${P.controlPerimeterFactor}*{d}`,
      engine: g.sizeX,
      unit: "mm",
      ref: "6.4.2(1)",
      numFmt: NUMBER_FORMATS.one,
    },
    {
      key: "bz",
      label: "Control perimeter dimension along Y",
      symbol: "bz",
      formula: `{c2}+2*${P.controlPerimeterFactor}*{d}`,
      engine: g.sizeY,
      unit: "mm",
      ref: "6.4.2(1)",
      numFmt: NUMBER_FORMATS.one,
    },
    {
      key: "u1gross",
      label: "Gross basic control perimeter",
      symbol: "u1",
      formula: `2*({c1}+{c2})+2*PI()*${P.controlPerimeterFactor}*{d}`,
      engine: g.grossPerimeter,
      unit: "mm",
      ref: "6.4.2(1)",
      numFmt: NUMBER_FORMATS.one,
    },
    ...g.openingReductions.map((o): CalcRow => ({
      key: `red${o.openingIndex}`,
      label: `Opening O${o.openingIndex + 1} ${o.applied ? "ineffective length" : "(beyond 6d: ignored)"}`,
      symbol: `Δu O${o.openingIndex + 1}`,
      engine: o.reduction,
      unit: "mm",
      ref: "6.4.2(3)",
      numFmt: NUMBER_FORMATS.one,
    })),
    {
      key: "u1",
      label: "Effective basic control perimeter",
      symbol: "u1,eff",
      ...(additive
        ? {
            formula: [
              "{u1gross}",
              ...g.openingReductions.map((o) => `{red${o.openingIndex}}`),
            ].join("-"),
          }
        : {}),
      engine: g.effectivePerimeter,
      unit: "mm",
      ref: "6.4.2(3)",
      numFmt: NUMBER_FORMATS.one,
      emphasize: true,
    },
    {
      key: "u0",
      label: "Column perimeter (interior column)",
      symbol: "u0",
      formula: "2*({c1}+{c2})",
      engine: g.columnPerimeter,
      unit: "mm",
      ref: "6.4.5(3)",
      numFmt: NUMBER_FORMATS.one,
    },
    {
      key: "xc",
      label: "Centroid of effective perimeter, x",
      symbol: "x̄",
      engine: g.centroidX,
      unit: "mm",
      ref: "",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "yc",
      label: "Centroid of effective perimeter, y",
      symbol: "ȳ",
      engine: g.centroidY,
      unit: "mm",
      ref: "",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "W1x",
      label: "W1 about X axis = ∫|y − ȳ| dl",
      symbol: "W1x",
      engine: g.W1x,
      unit: "mm²",
      ref: "(6.40)",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "W1y",
      label: "W1 about Y axis = ∫|x − x̄| dl",
      symbol: "W1y",
      engine: g.W1y,
      unit: "mm²",
      ref: "(6.40)",
      numFmt: NUMBER_FORMATS.integer,
    },
  ];
  const end = writeCalcTable(ws, 4, rows, refs);
  noteRow(
    ws,
    end + 1,
    "Yellow cells are live Excel formulas referencing the Inputs sheet. White 'Excel' cells are engine values: the rounded perimeter with opening tangents and the integral W1 are computed by the engine.",
    7,
  );
}

function buildDemand(wb: ExcelJS.Workbook, p: PunchingWorkbookEC2Params, refs: CellRefs) {
  const ws = wb.addWorksheet(SHEET_NAMES_EC2.demand, { views: [{ state: "frozen", ySplit: 4 }] });
  prepareSheet(ws, true);
  setColumns(ws, [40, 12, 18, 16, 14, 8, 16]);
  titleBand(
    ws,
    "Punching shear demand",
    "vEd = β VEd / (ui d) — §6.4.3(3), expressions (6.38), (6.39), (6.43)",
    7,
  );
  const dm = p.result.demand;
  const hasX = p.input.MEdy > 0;
  const hasY = p.input.MEdx > 0;
  const betaFormula =
    hasX && hasY
      ? `1+${P.biaxialBetaCoefficient}*SQRT(({eX}/{bz})^2+({eY}/{by})^2)`
      : hasX
        ? "1+{kBeta}*({MEdyN}/{VEdN})*({u1}/{W1y})"
        : hasY
          ? "1+{kBeta}*({MEdxN}/{VEdN})*({u1}/{W1x})"
          : "1";
  const kBeta = p.result.steps.find((s) => s.id === "k")?.value;
  const rows: CalcRow[] = [
    {
      key: "VEdN",
      label: "Design shear force",
      symbol: "VEd",
      formula: `{VEd}*${KN_TO_N}`,
      engine: p.input.VEd,
      unit: "N",
      ref: "",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "MEdxN",
      label: "Unbalanced moment about X",
      symbol: "MEdx",
      formula: `ABS({MEdx})*${KNM_TO_NMM}`,
      engine: Math.abs(p.input.MEdx),
      unit: "N·mm",
      ref: "",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "MEdyN",
      label: "Unbalanced moment about Y",
      symbol: "MEdy",
      formula: `ABS({MEdy})*${KNM_TO_NMM}`,
      engine: Math.abs(p.input.MEdy),
      unit: "N·mm",
      ref: "",
      numFmt: NUMBER_FORMATS.integer,
    },
    {
      key: "eX",
      label: "Eccentricity along X",
      symbol: "eX",
      formula: "{MEdyN}/{VEdN}",
      engine: dm.eccentricityX,
      unit: "mm",
      ref: "6.4.3(3)",
      numFmt: NUMBER_FORMATS.two,
    },
    {
      key: "eY",
      label: "Eccentricity along Y",
      symbol: "eY",
      formula: "{MEdxN}/{VEdN}",
      engine: dm.eccentricityY,
      unit: "mm",
      ref: "6.4.3(3)",
      numFmt: NUMBER_FORMATS.two,
    },
    ...(kBeta !== undefined
      ? [
          {
            key: "kBeta",
            label: "k from Table 6.1 (interpolated)",
            symbol: "k",
            engine: kBeta,
            unit: "—",
            ref: "Table 6.1",
            numFmt: NUMBER_FORMATS.four,
          } satisfies CalcRow,
        ]
      : []),
    {
      key: "beta",
      label: `β (${dm.betaMethod === "concentric" ? "concentric" : `expression ${dm.betaMethod}`})`,
      symbol: "β",
      formula: betaFormula,
      engine: dm.beta,
      unit: "—",
      ref: "6.4.3(3)",
      numFmt: NUMBER_FORMATS.four,
      emphasize: true,
    },
    {
      key: "ved",
      label: "Design shear stress at u1",
      symbol: "vEd",
      formula: "{beta}*{VEdN}/({u1}*{d})",
      engine: dm.directShear,
      unit: "MPa",
      ref: "(6.38)",
      numFmt: NUMBER_FORMATS.three,
      emphasize: true,
    },
    {
      key: "ved0",
      label: "Design shear stress at the column perimeter",
      symbol: "vEd,0",
      formula: "{beta}*{VEdN}/({u0}*{d})",
      engine: dm.columnFaceShear,
      unit: "MPa",
      ref: "6.4.5(3)",
      numFmt: NUMBER_FORMATS.three,
    },
  ];
  const end = writeCalcTable(ws, 4, rows, refs);

  const traceStart = end + 1;
  sectionHeading(ws, traceStart, "Calculation trace (engine)", 7);
  const th = ws.getRow(traceStart + 1);
  th.values = ["Step", "Formula", "Substitution", "", "Result", "Unit", "EN 1992-1-1"];
  headerRow(th);
  ws.mergeCells(traceStart + 1, 3, traceStart + 1, 4);
  let r = traceStart + 2;
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

function buildResistance(wb: ExcelJS.Workbook, p: PunchingWorkbookEC2Params, refs: CellRefs) {
  const ws = wb.addWorksheet(SHEET_NAMES_EC2.resistance, {
    views: [{ state: "frozen", ySplit: 4 }],
  });
  prepareSheet(ws, true);
  setColumns(ws, [40, 12, 18, 16, 14, 8, 16]);
  titleBand(
    ws,
    "Punching shear resistance",
    "§6.4.4(1) (6.47), (6.3N); §6.4.5(3) vRd,max; recommended National Annex values, σcp = 0.",
    7,
  );
  const c = p.result.capacity;
  const rows: CalcRow[] = [
    {
      key: "kSize",
      label: "Size factor",
      symbol: "k",
      formula: `MIN(${P.sizeFactorMax},1+SQRT(${P.sizeFactorNumerator}/{d}))`,
      engine: c.k,
      unit: "—",
      ref: "6.4.4(1)",
      numFmt: NUMBER_FORMATS.four,
    },
    {
      key: "rhoL",
      label: "Reinforcement ratio",
      symbol: "ρl",
      formula: `MIN(${P.rhoMax},SQRT({rhoX}/100*{rhoY}/100))`,
      engine: c.rhoL,
      unit: "—",
      ref: "6.4.4(1)",
      numFmt: "0.00000",
    },
    {
      key: "cRdc",
      label: "CRd,c = 0.18 / γc",
      symbol: "CRd,c",
      formula: `${P.cRdcNumerator}/${P.gammaC}`,
      engine: c.cRdc,
      unit: "—",
      ref: "6.4.4(1)",
      numFmt: NUMBER_FORMATS.four,
    },
    {
      key: "vf",
      label: "CRd,c k (100 ρl fck)^(1/3)",
      symbol: "(6.47)",
      formula: "{cRdc}*{kSize}*(100*{rhoL}*{fck})^(1/3)",
      engine: c.vRdcFormula,
      unit: "MPa",
      ref: "(6.47)",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "vmin",
      label: "vmin = 0.035 k^(3/2) fck^(1/2)",
      symbol: "vmin",
      formula: `${P.vMinCoefficient}*{kSize}^${P.vMinKExponent}*SQRT({fck})`,
      engine: c.vMin,
      unit: "MPa",
      ref: "(6.3N)",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "vrdc",
      label: "Punching shear resistance",
      symbol: "vRd,c",
      formula: "MAX({vf},{vmin})",
      engine: c.vRdc,
      unit: "MPa",
      ref: "(6.47)",
      numFmt: NUMBER_FORMATS.three,
      emphasize: true,
    },
    {
      key: "nu",
      label: "ν = 0.6 (1 − fck/250)",
      symbol: "ν",
      formula: `${P.nuCoefficient}*(1-{fck}/${P.nuFckDivisor})`,
      engine: c.nu,
      unit: "—",
      ref: "(6.6N)",
      numFmt: NUMBER_FORMATS.four,
    },
    {
      key: "fcd",
      label: "fcd = αcc fck / γc",
      symbol: "fcd",
      formula: `${P.alphaCc}*{fck}/${P.gammaC}`,
      engine: c.fcd,
      unit: "MPa",
      ref: "(3.15)",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "vrdmax",
      label: "Maximum resistance at the column perimeter",
      symbol: "vRd,max",
      formula: `${P.vRdMaxCoefficient}*{nu}*{fcd}`,
      engine: c.vRdMax,
      unit: "MPa",
      ref: "6.4.5(3)",
      numFmt: NUMBER_FORMATS.three,
      emphasize: true,
    },
    {
      key: "dcr1",
      label: "Utilization at u1",
      symbol: "vEd/vRd,c",
      formula: "{ved}/{vrdc}",
      engine: p.result.dcrAtControlPerimeter,
      unit: "—",
      ref: "6.4.3(2)",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "dcr0",
      label: "Utilization at the column perimeter",
      symbol: "vEd,0/vRd,max",
      formula: "{ved0}/{vrdmax}",
      engine: p.result.dcrAtColumnFace,
      unit: "—",
      ref: "6.4.3(2)",
      numFmt: NUMBER_FORMATS.three,
    },
    {
      key: "dcr",
      label: "Demand / capacity ratio",
      symbol: "DCR",
      formula: "MAX({dcr1},{dcr0})",
      engine: p.result.dcr,
      unit: "—",
      ref: "6.4.3(2)",
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
  statusStyle(ws.getCell(end - 1, 3), p.result.status);
  statusStyle(ws.getCell(end - 1, 4), p.result.status);
  noteRow(
    ws,
    end + 1,
    `Governing: ${p.result.governingCheck}. Engine values are authoritative; Δ should be ≈ 0 after Excel recalculates. EXPERIMENTAL module.`,
    7,
  );
}

function buildSummary(wb: ExcelJS.Workbook, p: PunchingWorkbookEC2Params, refs: CellRefs) {
  const ws = wb.getWorksheet(SHEET_NAMES_EC2.summary);
  if (!ws) return;
  prepareSheet(ws);
  setColumns(ws, [30, 22, 4, 30, 22]);
  titleBand(
    ws,
    "EN 1992-1-1 Two-Way Punching Shear — Summary",
    `${safeText(p.project.name || "Untitled project")} · ${safeText(p.project.member || "Member")} · Rev ${safeText(p.project.revision || "0")}`,
    5,
  );
  const { result } = p;
  ws.mergeCells("A4:B4");
  ws.getCell("A4").value = "DEMAND / CAPACITY RATIO (EXPERIMENTAL)";
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

  const kv: [string, string][] = [
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
      "Effective control perimeter u1",
      "u1",
      result.geometry.effectivePerimeter,
      "mm",
      "§6.4.2",
      NUMBER_FORMATS.one,
    ],
    ["β", "beta", result.demand.beta, "—", "§6.4.3(3)", NUMBER_FORMATS.four],
    [
      "Design shear stress vEd",
      "ved",
      result.demand.directShear,
      "MPa",
      "(6.38)",
      NUMBER_FORMATS.three,
    ],
    ["Resistance vRd,c", "vrdc", result.capacity.vRdc, "MPa", "(6.47)", NUMBER_FORMATS.three],
    [
      "Maximum resistance vRd,max",
      "vrdmax",
      result.capacity.vRdMax,
      "MPa",
      "§6.4.5(3)",
      NUMBER_FORMATS.three,
    ],
    ["DCR", "dcr", result.dcr, "—", "§6.4.3(2)", NUMBER_FORMATS.three],
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
    ws.mergeCells(r, 2, r, 5);
    ws.getCell(r, 2).value = safeText(w.message);
    bodyCell(ws.getCell(r, 2));
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
    "Engineering disclaimer: results require review by a qualified engineer. Confirm code applicability, the National Annex and project-specific conditions; additional checks may be required. This software does not replace professional engineering judgment. The EN 1992-1-1 module is Experimental. Independently review calculations before issuing construction documents.";
  disc.font = font({ size: 9, italic: true, color: { argb: PALETTE.muted } });
  disc.alignment = { wrapText: true, vertical: "top" };
  disc.fill = solid(PALETTE.panel);
}

function buildAudit(wb: ExcelJS.Workbook, p: PunchingWorkbookEC2Params, exportedAt: Date) {
  const ws = wb.addWorksheet(SHEET_NAMES_EC2.audit);
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
    if (k === "Method") ws.getRow(r).height = 75;
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
    ws.getRow(r).values = [`${ref.code}:${ref.edition}`, ref.section, ref.description];
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
  r = writeChecklistSection(ws, r + 1, p.checklist);
  r += 1;
  sectionHeading(ws, r, "Input snapshot (canonical units: N, N·mm, mm, MPa) — JSON", 3);
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

/** Builds the formatted EN 1992-1-1 workbook. */
export function buildPunchingWorkbookEC2(params: PunchingWorkbookEC2Params): ExcelJS.Workbook {
  const exportedAt = params.exportedAt ?? new Date();
  const wb = new ExcelJS.Workbook();
  wb.creator = "Civil Engineering Platform";
  wb.created = exportedAt;
  wb.modified = exportedAt;
  wb.title = `Punching shear (EN 1992-1-1) — ${params.project.member}`;
  wb.calcProperties = { fullCalcOnLoad: true };
  const refs: CellRefs = new Map();
  wb.addWorksheet(SHEET_NAMES_EC2.summary, { properties: { tabColor: { argb: PALETTE.blue } } });
  buildInputs(wb, params, refs);
  buildGeometry(wb, params, refs);
  buildDemand(wb, params, refs);
  buildResistance(wb, params, refs);
  buildSummary(wb, params, refs);
  buildAudit(wb, params, exportedAt);
  return wb;
}

export async function exportPunchingWorkbookEC2(
  params: PunchingWorkbookEC2Params,
): Promise<Uint8Array> {
  const buffer = await buildPunchingWorkbookEC2(params).xlsx.writeBuffer();
  return new Uint8Array(buffer as ArrayBuffer);
}

// Re-exported for symmetry with the ACI builder.
export { CALC_COLUMNS };
