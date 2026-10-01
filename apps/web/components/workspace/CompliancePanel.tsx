import { CODE_LABELS } from "@/lib/calc";
import type { Calc } from "@/lib/calc";
import { automaticChecks, itemsFor } from "@/lib/compliance";
import type { ChecklistItem } from "@/lib/compliance";
import type { FormState } from "@/lib/form";
import { Pane } from "../layout/Pane";

interface CompliancePanelProps {
  calc: Calc;
  form: FormState;
  onChange: (next: FormState) => void;
}

/** Engineering compliance checklist for the active design code, saved with the project. */
export function CompliancePanel({ calc, form, onChange }: CompliancePanelProps) {
  const { common, specific } = itemsFor(calc.code);
  const manual = [...common, ...specific];
  const confirmed = manual.filter((i) => form.checklist[i.id] === true).length;
  const autos = automaticChecks(calc, form);
  const setAll = (value: boolean) =>
    onChange({
      ...form,
      checklist: { ...form.checklist, ...Object.fromEntries(manual.map((i) => [i.id, value])) },
    });
  const toggle = (id: string, value: boolean) =>
    onChange({ ...form, checklist: { ...form.checklist, [id]: value } });

  const group = (title: string, items: ChecklistItem[]) => (
    <fieldset className="group checklist">
      <legend className="group-title">{title}</legend>
      {items.map((item) => (
        <label className="check" key={item.id}>
          <input
            type="checkbox"
            checked={form.checklist[item.id] === true}
            onChange={(e) => toggle(item.id, e.target.checked)}
          />
          <span>
            {item.label}
            {item.clause && <span className="ref"> {item.clause}</span>}
          </span>
        </label>
      ))}
    </fieldset>
  );

  return (
    <Pane
      id="compliance"
      badge={
        <span
          className={`badge ${confirmed === manual.length ? "pass" : "info"}`}
          aria-label={`${confirmed} of ${manual.length} confirmations ticked`}
        >
          {confirmed}/{manual.length}
        </span>
      }
    >
      <p className="small" style={{ marginTop: 0 }}>
        Engineering compliance for <strong>{CODE_LABELS[calc.code].short}</strong> (
        {CODE_LABELS[calc.code].region} practice). Confirmations are yours to tick; automatic checks
        come from the calculation. Saved with the project and written to the Excel / JSON record.
      </p>
      <fieldset className="group checklist">
        <legend className="group-title">Automatic checks</legend>
        {autos.map((c) => (
          <label className="check" key={c.id}>
            <input type="checkbox" checked={c.passed} disabled readOnly aria-label={c.label} />
            <span>
              {c.label}
              {c.detail && <span className="ref"> {c.detail}</span>}
            </span>
          </label>
        ))}
      </fieldset>
      {group("Engineer confirmations — both codes", common)}
      {group(`Engineer confirmations — ${CODE_LABELS[calc.code].short}`, specific)}
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" className="btn small" onClick={() => setAll(true)}>
          Tick all
        </button>
        <button type="button" className="btn small" onClick={() => setAll(false)}>
          Clear
        </button>
      </div>
    </Pane>
  );
}
