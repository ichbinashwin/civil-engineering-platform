"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { calculatePunchingShear } from "@civil/engineering-core";
import { EXAMPLE_FORM, fieldMessages, toEngineInput } from "@/lib/form";
import type { FormState } from "@/lib/form";
import { DockRail } from "../layout/DockRail";
import { LayoutBar } from "../layout/LayoutBar";
import { Pane } from "../layout/Pane";
import { PaneLayoutProvider, usePaneLayout } from "../layout/PaneLayout";
import { ThemeControls } from "../theme/ThemeControls";
import { VisualizationPanel } from "../viz/VisualizationPanel";
import { CalculationTrace } from "./CalculationTrace";
import { InputPanel } from "./InputPanel";
import { KpiStrip } from "./KpiStrip";
import { ResultCard } from "./ResultCard";
import { ResultTables } from "./ResultTables";
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
    return { form: { ...EXAMPLE_FORM, ...parsed.form }, review: parsed.review ?? null };
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

/**
 * Engineering workspace: every input is editable (human in the loop) and every output —
 * KPIs, tables, trace, plan, 3D, messages — recalculates live from the engine.
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

  const input = useMemo(() => toEngineInput(form), [form]);
  const inputSignature = useMemo(() => JSON.stringify(input), [input]);
  const outcome = useMemo(() => calculatePunchingShear(input), [input]);
  const messages = useMemo(() => fieldMessages(outcome.warnings, form), [outcome, form]);

  // Heavy visualization lags behind typing; numbers update immediately.
  const vizInput = useDeferredValue(input);
  const vizOutcome = useDeferredValue(outcome);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ form, review } satisfies Stored));
    } catch {
      // Storage unavailable (private mode): workspace still works without persistence.
    }
  }, [form, review]);

  const [excelState, setExcelState] = useState<"idle" | "busy" | "error">("idle");
  const fileStem = `punching-${form.memberName.replace(/[^\w-]+/g, "_") || "calc"}-rev${form.revision.replace(/[^\w-]+/g, "_") || "0"}`;

  const exportExcel = async () => {
    if (!outcome.ok) return;
    setExcelState("busy");
    try {
      // Loaded on demand to keep ExcelJS out of the initial bundle.
      const { exportPunchingWorkbook, XLSX_MIME } = await import("@civil/engineering-excel");
      const bytes = await exportPunchingWorkbook({
        project: {
          name: form.projectName,
          member: form.memberName,
          engineer: form.engineer,
          revision: form.revision,
        },
        input,
        result: outcome,
        review: review ? { ...review, current: review.inputSignature === inputSignature } : null,
      });
      download(`${fileStem}.xlsx`, bytes as Uint8Array<ArrayBuffer>, XLSX_MIME);
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
          project: {
            name: form.projectName,
            member: form.memberName,
            engineer: form.engineer,
            revision: form.revision,
          },
          input,
          outcome,
          review,
        },
        null,
        2,
      ),
    );
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
              <h1 className="app-title">ACI 318-19 Punching Shear</h1>
              <div className="subtitle">
                {form.projectName || "Untitled project"} · {form.memberName || "Member"} · Rev{" "}
                {form.revision || "0"} · live calculation
              </div>
            </div>
          </div>
          <div className="topbar-right">
            <ThemeControls />
            <div className="actions">
              <button type="button" className="btn" onClick={() => window.print()}>
                Print / PDF
              </button>
              <button
                type="button"
                className="btn excel"
                onClick={exportExcel}
                disabled={!outcome.ok || excelState === "busy"}
                title={
                  outcome.ok
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
                  setForm(EXAMPLE_FORM);
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
            <KpiStrip outcome={outcome} />
            <VisualizationPanel
              input={vizInput}
              outcome={vizOutcome}
              selectedOpening={selectedOpening}
              onSelectOpening={setSelectedOpening}
            />
            {outcome.ok ? (
              <>
                <ResultTables result={outcome} />
                <CalculationTrace steps={outcome.steps} />
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
            className={`col col-right stack sticky-col${colEmpty(["result", "review", "messages", "refs"]) ? " col-empty" : ""}`}
          >
            <Pane id="result">
              <ResultCard outcome={outcome} />
            </Pane>
            <ReviewPanel
              outcome={outcome}
              inputSignature={inputSignature}
              review={review}
              onReview={setReview}
              defaultReviewer={form.engineer}
            />
            <WarningsList warnings={outcome.warnings} />
            <Pane id="refs">
              {outcome.ok ? (
                <ul className="warnings">
                  {outcome.codeReferences.map((r) => (
                    <li key={r.section}>
                      <span className="ref">§{r.section}</span>
                      <span className="small">{r.description}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small">Available when the calculation is valid.</p>
              )}
              {outcome.ok && (
                <p className="small" style={{ marginBottom: 0 }}>
                  {outcome.meta.designCode} · engine v{outcome.meta.engineVersion}
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
      <div className="footer">
        ACI 318-19 provisions applied: §8.4.2.2, §8.4.4.2, §21.2.1, §22.5.5.1.3, §22.6, §22.6.3.1,
        §22.6.4, §22.6.4.1, §22.6.4.3 and Table 22.6.5.2. Verify the governing provisions for the
        project.
      </div>
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
