import type { Worksheet } from "exceljs";
import { PALETTE, bodyCell, font, headerRow, safeText, sectionHeading } from "./style";

/** One line of the engineering compliance checklist for the Audit sheet. */
export interface AuditChecklistItem {
  section: string;
  label: string;
  checked: boolean;
  /** True for checks derived from the calculation (not ticked by hand). */
  automatic: boolean;
}

/** Writes the checklist section (Audit sheet, 3 columns); returns the next free row. */
export function writeChecklistSection(
  ws: Worksheet,
  startRow: number,
  items: AuditChecklistItem[] | undefined,
): number {
  if (!items || items.length === 0) return startRow;
  let r = startRow;
  const confirmed = items.filter((i) => !i.automatic && i.checked).length;
  const manual = items.filter((i) => !i.automatic).length;
  sectionHeading(
    ws,
    r,
    `Engineering compliance checklist — ${confirmed}/${manual} confirmations`,
    3,
  );
  r += 1;
  const head = ws.getRow(r);
  head.values = ["Section", "Status", "Item"];
  headerRow(head);
  r += 1;
  for (const item of items) {
    ws.getRow(r).values = [
      safeText(item.section),
      item.automatic
        ? item.checked
          ? "✔ automatic"
          : "✘ automatic"
        : item.checked
          ? "✔ confirmed"
          : "☐ open",
      safeText(item.label),
    ];
    [1, 2, 3].forEach((c) => bodyCell(ws.getCell(r, c), { align: c === 2 ? "center" : "left" }));
    ws.getCell(r, 2).font = font({
      bold: true,
      color: { argb: item.checked ? PALETTE.green : PALETTE.amber },
    });
    r += 1;
  }
  return r;
}
