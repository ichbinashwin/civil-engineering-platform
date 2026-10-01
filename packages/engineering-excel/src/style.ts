import type { Borders, Cell, Fill, Font, Row, Worksheet } from "exceljs";

/** Workbook visual language — matches the web workspace (restrained engineering palette). */
export const PALETTE = {
  blue: "FF1F4E78",
  blueLight: "FFE8F1F8",
  ink: "FF17212B",
  muted: "FF66727F",
  line: "FFDBE1E6",
  panel: "FFF6F7F9",
  green: "FF16805B",
  greenBg: "FFE9F7F0",
  red: "FFB42318",
  redBg: "FFFFF0EE",
  amber: "FFB7791F",
  amberBg: "FFFFF7E6",
  white: "FFFFFFFF",
} as const;

export const NUMBER_FORMATS = {
  integer: "#,##0",
  one: "#,##0.0",
  two: "#,##0.00",
  three: "#,##0.000",
  four: "0.0000",
  delta: "0.0E+00",
} as const;

const THIN = { style: "thin" as const, color: { argb: PALETTE.line } };
export const BORDER_ALL: Partial<Borders> = { top: THIN, left: THIN, bottom: THIN, right: THIN };

export function solid(argb: string): Fill {
  return { type: "pattern", pattern: "solid", fgColor: { argb } };
}

export function font(overrides: Partial<Font> = {}): Partial<Font> {
  return { name: "Calibri", size: 10, color: { argb: PALETTE.ink }, ...overrides };
}

/** Sheet title band (row 1) and subtitle (row 2), merged across `columns`. */
export function titleBand(ws: Worksheet, title: string, subtitle: string, columns: number) {
  ws.mergeCells(1, 1, 1, columns);
  ws.mergeCells(2, 1, 2, columns);
  const t = ws.getCell(1, 1);
  t.value = title;
  t.font = font({ size: 15, bold: true, color: { argb: PALETTE.white } });
  t.fill = solid(PALETTE.blue);
  t.alignment = { vertical: "middle", indent: 1 };
  ws.getRow(1).height = 28;
  const s = ws.getCell(2, 1);
  s.value = subtitle;
  s.font = font({ size: 9, italic: true, color: { argb: PALETTE.muted } });
  s.alignment = { indent: 1 };
  ws.getRow(2).height = 16;
}

export function sectionHeading(ws: Worksheet, rowIndex: number, text: string, columns: number) {
  ws.mergeCells(rowIndex, 1, rowIndex, columns);
  const c = ws.getCell(rowIndex, 1);
  c.value = text.toUpperCase();
  c.font = font({ size: 9, bold: true, color: { argb: PALETTE.blue } });
  c.border = { bottom: { style: "medium", color: { argb: PALETTE.blue } } };
  ws.getRow(rowIndex).height = 18;
}

export function headerRow(row: Row) {
  row.eachCell((cell) => {
    cell.font = font({ bold: true, color: { argb: PALETTE.white } });
    cell.fill = solid(PALETTE.blue);
    cell.border = BORDER_ALL;
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  });
  row.height = 20;
}

export function bodyCell(
  cell: Cell,
  options: {
    numFmt?: string;
    bold?: boolean;
    align?: "left" | "right" | "center";
    fill?: string;
  } = {},
) {
  cell.font = font({ bold: options.bold ?? false });
  cell.border = BORDER_ALL;
  cell.alignment = {
    vertical: "middle",
    horizontal: options.align ?? "left",
    wrapText: options.align === "left",
  };
  if (options.numFmt) cell.numFmt = options.numFmt;
  if (options.fill) cell.fill = solid(options.fill);
}

export function statusStyle(cell: Cell, status: string) {
  const pass = status === "PASS";
  cell.font = font({ bold: true, size: 12, color: { argb: pass ? PALETTE.green : PALETTE.red } });
  cell.fill = solid(pass ? PALETTE.greenBg : PALETTE.redBg);
  cell.alignment = { horizontal: "center", vertical: "middle" };
  cell.border = BORDER_ALL;
}

/**
 * Text written to the workbook is always a string cell (never a formula). Control characters are
 * removed and length is capped; a leading formula trigger is neutralized for CSV re-export safety.
 */
const MAX_TEXT_LENGTH = 2000;
const FORMULA_TRIGGERS = /^[=+\-@\t\r]/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function safeText(value: string): string {
  const cleaned = value.replace(CONTROL_CHARS, "").slice(0, MAX_TEXT_LENGTH);
  return FORMULA_TRIGGERS.test(cleaned) ? `'${cleaned}` : cleaned;
}
