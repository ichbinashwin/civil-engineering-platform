"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CODE_LABELS, kpisOf, runCalc, vizOf } from "@/lib/calc";
import { checklistRecord } from "@/lib/compliance";
import {
  DESIGN_CODES,
  EXAMPLE_FORM,
  convertFormToCode,
  exampleFor,
  fieldMessages,
} from "@/lib/form";
import type { FormState } from "@/lib/form";
import { DockRail } from "../layout/DockRail";
import { LayoutBar } from "../layout/LayoutBar";
import { Pane } from "../layout/Pane";
import { PaneLayoutProvider, usePaneLayout } from "../layout/PaneLayout";
import { ThemeControls } from "../theme/ThemeControls";
import { VisualizationPanel } from "../viz/VisualizationPanel";
import { CalculationTrace } from "./CalculationTrace";
import { CodeSwitch } from "./CodeSwitch";
import { CompliancePanel } from "./CompliancePanel";
import { InputPanel } from "./InputPanel";
import { KpiStrip } from "./KpiStrip";
import { ResultCard } from "./ResultCard";
import { ResultTables, ResultTablesEC2 } from "./ResultTables";
import { ReviewPanel } from "./ReviewPanel";
import type { ReviewRecord } from "./ReviewPanel";
import { WarningsList } from "./WarningsList";

const STORAGE_KEY = "civil-platform:punching:v1";

interface Stored {
  form: FormState;
  review: ReviewRecord | null;
}

function loadStored(): Stored | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Stored>;
    if (!parsed.form || !Array.isArray(parsed.form.openings)) return null;
    const code = DESIGN_CODES.includes(parsed.form.code) ? parsed.form.code : EXAMPLE_FORM.code;
    return {
      form: { ...exampleFor(code), ...parsed.form, code, checklist: parsed.form.checklist ?? {} },
      review: parsed.review ?? null,
    };
  } catch {
    return null;
  }
}

function download(filename: string, content: BlobPart, type = "application/json") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Code provisions applied, shown in the page footer. */
const FOOTER_PROVISIONS: Record<FormState["code"], string> = {
  "ACI 318-19":
    "ACI 318-19 provisions applied: §8.4.2.2, §8.4.4.2, §21.2.1, §22.5.5.1.3, §22.6, §22.6.3.1, §22.6.4, §22.6.4.1, §22.6.4.3 and Table 22.6.5.2. Verify the governing provisions for the project.",
  "EN 1992-1-1":
    "EN 1992-1-1:2004 provisions applied (Experimental): §6.4.2(1), §6.4.2(3), §6.4.3, Table 6.1, (6.39), (6.40), (6.43), §6.4.4 (6.47), (6.3N), §6.4.5(3), (6.6N), recommended National Annex values. Confirm the National Annex of the project country.",
};

/**
 * Engineering workspace: every input is editable (human in the loop) and every output —
 * KPIs, tables, trace, plan, 3D, messages — recalculates live from the engine of the selected code.
 */
function WorkspaceInner() {
  const [initial] = useState(loadStored);
  const [form, setForm] = useState<FormState>(initial?.form ?? EXAMPLE_FORM);
  const [review, setReview] = useState<ReviewRecord | null>(initial?.review ?? null);
  const [selectedOpening, setSelectedOpening] = useState<string | null>(null);
  const { isDocked, dockedOn } = usePaneLayout();
  // A column whose panes are all docked disappears from the flow (display: contents); a peeked pane
  // is position: fixed, so it still renders.
  const colEmpty = (ids: Parameters<typeof isDocked>[0][]) => ids.every((id) => isDocked(id));

  // Only engine-relevant fields trigger a recalculation (names, checklist … do not), and only the
  // selected code's engine runs.
  const {
    code,
    Vu,
    Mux,
    Muy,
    c1,
    c2,
    d,
    h,
    fc,
    lambda,
    rhoX,
    rhoY,
    columnLocation,
    reinforcement,
    applySizeEffect,
    momentSign,
    openings,
  } = form;
  const calc = useMemo(
    () =>
      runCalc({
        code,
        Vu,
        Mux,
        Muy,
        c1,
        c2,
        d,
        h,
        fc,
        lambda,
        rhoX,
        rhoY,
        columnLocation,
        reinforcement,
        applySizeEffect,
        momentSign,
        openings,
      }),
    [
      code,
      Vu,
      Mux,
      Muy,
      c1,
      c2,
      d,
      h,
      fc,
      lambda,
      rhoX,
      rhoY,
      columnLocation,
      reinforcement,
      applySizeEffect,
      momentSign,
      openings,
    ],
  );
  const inputSignature = useMemo(() => `${calc.code}:${JSON.stringify(calc.input)}`, [calc]);
  const messages = useMemo(
    () => fieldMessages(calc.outcome.warnings, { openings }),
    [calc, openings],
  );
  const kpis = useMemo(() => kpisOf(calc), [calc]);
  const viz = useMemo(() => vizOf(calc), [calc]);

  // Heavy visualization lags behind typing; numbers update immediately.
  const vizDeferred = useDeferredValue(viz);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, review } satisfies Stored));
    } catch {
      // Storage unavailable (private mode): workspace still works without persistence.
    }
  }, [form, review]);

  const [excelState, setExcelState] = useState<"idle" | "busy" | "error">("idle");
  const fileStem = `punching-${form.code === "EN 1992-1-1" ? "ec2-" : ""}${form.memberName.replace(/[^\w-]+/g, "_") || "calc"}-rev${form.revision.replace(/[^\w-]+/g, "_") || "0"}`;
  const project = {
    name: form.projectName,
    member: form.memberName,
    engineer: form.engineer,
    revision: form.revision,
  };
  const reviewForExport = review
    ? { ...review, current: review.inputSignature === inputSignature }
    : null;

  const exportExcel = async () => {
    if (!calc.outcome.ok) return;
    setExcelState("busy");
    try {
      // Loaded on demand to keep ExcelJS out of the initial bundle.
      const excel = await import("@civil/engineering-excel");
      const checklist = checklistRecord(calc, form).items;
      const bytes =
        calc.code === "EN 1992-1-1" && calc.outcome.ok
          ? await excel.exportPunchingWorkbookEC2({
              project,
              input: calc.input,
              result: calc.outcome,
              review: reviewForExport,
              checklist,
            })
          : calc.code === "ACI 318-19" && calc.outcome.ok
            ? await excel.exportPunchingWorkbook({
                project,
                input: calc.input,
                result: calc.outcome,
                review: reviewForExport,
                checklist,
              })
            : null;
      if (!bytes) return;
      download(`${fileStem}.xlsx`, bytes as Uint8Array<ArrayBuffer>, excel.XLSX_MIME);
      setExcelState("idle");
    } catch (error) {
      console.error("Excel export failed", error);
      setExcelState("error");
    }
  };

  const exportSnapshot = () => {
    download(
      `${fileStem}.json`,
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          designCode: calc.code,
          project,
          input: calc.input,
          outcome: calc.outcome,
          review,
          complianceChecklist: checklistRecord(calc, form),
        },
        null,
        2,
      ),
    );
  };

  const switchCode = (next: FormState["code"]) => {
    setForm((current) => convertFormToCode(current, next));
    setSelectedOpening(null);
  };

  return (
    <>
      <header className="app-header">
        <div className="topbar">
          <div className="brand">
            <div className="logo" aria-hidden="true">
              CE
            </div>
            <div>
              <h1 className="app-title">{CODE_LABELS[form.code].title}</h1>
              <div className="subtitle">
                {form.projectName || "Untitled project"} · {form.memberName || "Member"} · Rev{" "}
                {form.revision || "0"} · live calculation
              </div>
            </div>
          </div>
          <div className="topbar-right">
            <CodeSwitch code={form.code} onChange={switchCode} />
            <ThemeControls />
            <div className="actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                Print / PDF
              </button>
              <button
                type="button"
                className="btn excel"
                onClick={exportExcel}
                disabled={!calc.outcome.ok || excelState === "busy"}
                title={
                  calc.outcome.ok
                    ? "Formatted workbook: Summary, Inputs, Geometry, Punching, Capacity, Audit"
                    : "Available when the calculation is valid"
                }
              >
                {excelState === "busy"
                  ? "Exporting…"
                  : excelState === "error"
                    ? "Excel failed — retry"
                    : "Export Excel"}
              </button>
              <button type="button" className="btn" onClick={exportSnapshot}>
                Export JSON
              </button>
              <button
                type="button"
                className="btn primary"
                onClick={() => {
                  setForm(exampleFor(form.code));
                  setSelectedOpening(null);
                }}
              >
                Reset example
              </button>
            </div>
          </div>
        </div>
      </header>

      <main
        className={`workspace${dockedOn("left").length > 0 ? " has-rail-left" : ""}${dockedOn("right").length > 0 ? " has-rail-right" : ""}`}
      >
        <LayoutBar />
        <div className="grid">
          <div className={`col col-left${colEmpty(["inputs"]) ? " col-empty" : ""}`}>
            <InputPanel
              form={form}
              onChange={setForm}
              messages={messages}
              selectedOpening={selectedOpening}
              onSelectOpening={setSelectedOpening}
            />
          </div>

          <div
            className={`col col-center stack${colEmpty(["kpis", "viz", "tables", "trace"]) ? " col-empty" : ""}`}
          >
            <KpiStrip items={kpis} />
            <VisualizationPanel
              input={vizDeferred.input}
              outcome={vizDeferred.outcome}
              selectedOpening={selectedOpening}
              onSelectOpening={setSelectedOpening}
            />
            {calc.outcome.ok ? (
              <>
                {calc.code === "ACI 318-19" ? (
                  <ResultTables result={calc.outcome} />
                ) : (
                  <ResultTablesEC2 result={calc.outcome} />
                )}
                <CalculationTrace steps={calc.outcome.steps} />
              </>
            ) : (
              <section className="panel">
                <div className="panel-body">
                  <p className="small" style={{ margin: 0 }}>
                    Tables and trace appear when the inputs are valid.
                  </p>
                </div>
              </section>
            )}
          </div>

          <div
            className={`col col-right stack sticky-col${colEmpty(["result", "review", "compliance", "messages", "refs"]) ? " col-empty" : ""}`}
          >
            <Pane id="result">
              <ResultCard calc={calc} />
            </Pane>
            <ReviewPanel
              outcome={calc.outcome}
              inputSignature={inputSignature}
              review={review}
              onReview={setReview}
              defaultReviewer={form.engineer}
            />
            <CompliancePanel calc={calc} form={form} onChange={setForm} />
            <WarningsList warnings={calc.outcome.warnings} />
            <Pane id="refs">
              {calc.outcome.ok ? (
                <ul className="warnings">
                  {calc.outcome.codeReferences.map((r) => (
                    <li key={r.section}>
                      <span className="ref">§{r.section}</span>
                      <span className="small">{r.description}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small">Available when the calculation is valid.</p>
              )}
              {calc.outcome.ok && (
                <p className="small" style={{ marginBottom: 0 }}>
                  {calc.outcome.meta.designCode} · engine v{calc.outcome.meta.engineVersion}
                </p>
              )}
            </Pane>
            <div className="note">
              <b>Engineering control:</b> This is a calculation aid, not a substitute for
              project-specific engineering review. Confirm code applicability, units, slab
              thickness, opening geometry, load combinations and detailing. Independently review
              results before issuing construction documents.
            </div>
          </div>
        </div>
      </main>
      <DockRail side="left" />
      <DockRail side="right" />
      <div className="footer">{FOOTER_PROVISIONS[form.code]}</div>
    </>
  );
}

export function Workspace() {
  return (
    <PaneLayoutProvider>
      <WorkspaceInner />
    </PaneLayoutProvider>
  );
}
