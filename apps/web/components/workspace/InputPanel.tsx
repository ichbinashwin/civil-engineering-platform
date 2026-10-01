import { useId } from "react";
import type { CalculationWarning } from "@civil/shared-types";
import { createOpening } from "@/lib/form";
import type { FormState, NumericField, OpeningForm } from "@/lib/form";
import { NumberField } from "./NumberField";

interface InputPanelProps {
  form: FormState;
  onChange: (next: FormState) => void;
  messages: Map<string, CalculationWarning[]>;
  selectedOpening: string | null;
  onSelectOpening: (key: string | null) => void;
}

const ACTIONS: { field: NumericField; label: string; unit: string }[] = [
  { field: "Vu", label: "Vu (factored shear)", unit: "kip" },
  { field: "Mux", label: "Mux (about X)", unit: "kip-ft" },
  { field: "Muy", label: "Muy (about Y)", unit: "kip-ft" },
];

const GEOMETRY: { field: NumericField; label: string; unit: string }[] = [
  { field: "c1", label: "c1 (column, X)", unit: "in" },
  { field: "c2", label: "c2 (column, Y)", unit: "in" },
  { field: "d", label: "Effective depth d", unit: "in" },
  { field: "h", label: "Slab thickness h", unit: "in" },
];

export function InputPanel({
  form,
  onChange,
  messages,
  selectedOpening,
  onSelectOpening,
}: InputPanelProps) {
  const ids = {
    project: useId(),
    engineer: useId(),
    member: useId(),
    rev: useId(),
    loc: useId(),
    reinf: useId(),
  };
  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    onChange({ ...form, [key]: value });
  const setOpening = (key: string, patch: Partial<OpeningForm>) =>
    set(
      "openings",
      form.openings.map((o) => (o.key === key ? { ...o, ...patch } : o)),
    );
  const field = (f: NumericField, label: string, unit: string, step?: string) => (
    <NumberField
      key={f}
      label={label}
      unit={unit}
      value={form[f]}
      onChange={(v) => set(f, v)}
      messages={messages.get(f)}
      {...(step ? { step } : {})}
    />
  );

  return (
    <aside className="panel" aria-label="Design inputs">
      <h2>
        Design Inputs <span className="badge info">Editable</span>
      </h2>
      <div className="panel-body">
        <fieldset className="group">
          <legend className="group-title">Project</legend>
          <div className="row wide">
            <label htmlFor={ids.project}>Project</label>
            <input
              id={ids.project}
              className="input text"
              value={form.projectName}
              onChange={(e) => set("projectName", e.target.value)}
            />
          </div>
          <div className="row wide">
            <label htmlFor={ids.member}>Member</label>
            <input
              id={ids.member}
              className="input text"
              value={form.memberName}
              onChange={(e) => set("memberName", e.target.value)}
            />
          </div>
          <div className="row wide">
            <label htmlFor={ids.engineer}>Engineer</label>
            <input
              id={ids.engineer}
              className="input text"
              value={form.engineer}
              onChange={(e) => set("engineer", e.target.value)}
              placeholder="Name"
            />
          </div>
          <div className="row wide">
            <label htmlFor={ids.rev}>Revision</label>
            <input
              id={ids.rev}
              className="input text"
              value={form.revision}
              onChange={(e) => set("revision", e.target.value)}
            />
          </div>
          <div className="row wide">
            <span className="field-label">Design code</span>
            <span className="unit" style={{ textAlign: "right" }}>
              ACI 318-19 (US units)
            </span>
          </div>
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">Factored actions</legend>
          {ACTIONS.map((a) => field(a.field, a.label, a.unit))}
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">Column / slab geometry</legend>
          {GEOMETRY.map((g) => field(g.field, g.label, g.unit))}
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">Material</legend>
          {field("fc", "f'c", "psi", "250")}
          {field("lambda", "λ (lightweight factor)", "—", "0.05")}
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">
            Openings ({form.openings.length})
            <button
              type="button"
              className="btn small"
              onClick={() => set("openings", [...form.openings, createOpening()])}
            >
              + Add opening
            </button>
          </legend>
          {form.openings.length === 0 && (
            <p className="small">No openings. Add one to assess §22.6.4.3.</p>
          )}
          {form.openings.map((o, i) => {
            const own = messages.get(`opening:${o.key}`) ?? [];
            const msg = (sub: string) => messages.get(`opening:${o.key}:${sub}`);
            return (
              <div
                key={o.key}
                className={`opening-card ${selectedOpening === o.key ? "selected" : ""}`}
                onFocus={() => onSelectOpening(o.key)}
              >
                <div className="opening-head">
                  <span>Opening {i + 1}</span>
                  <span style={{ display: "flex", gap: 4 }}>
                    <select
                      aria-label={`Opening ${i + 1} shape`}
                      className="input"
                      style={{ width: 96, padding: "3px 6px" }}
                      value={o.type}
                      onChange={(e) =>
                        setOpening(o.key, { type: e.target.value as OpeningForm["type"] })
                      }
                    >
                      <option value="circle">Circle</option>
                      <option value="rectangle">Rectangle</option>
                    </select>
                    <button
                      type="button"
                      className="btn small ghost"
                      aria-label={`Remove opening ${i + 1}`}
                      onClick={() => {
                        set(
                          "openings",
                          form.openings.filter((x) => x.key !== o.key),
                        );
                        if (selectedOpening === o.key) onSelectOpening(null);
                      }}
                    >
                      ✕
                    </button>
                  </span>
                </div>
                <NumberField
                  label="Center X"
                  unit="in"
                  value={o.x}
                  onChange={(v) => setOpening(o.key, { x: v })}
                  messages={msg("x")}
                />
                <NumberField
                  label="Center Y"
                  unit="in"
                  value={o.y}
                  onChange={(v) => setOpening(o.key, { y: v })}
                  messages={msg("y")}
                />
                {o.type === "circle" ? (
                  <NumberField
                    label="Diameter"
                    unit="in"
                    value={o.diameter}
                    onChange={(v) => setOpening(o.key, { diameter: v })}
                    messages={msg("diameter")}
                  />
                ) : (
                  <>
                    <NumberField
                      label="Width (X)"
                      unit="in"
                      value={o.width}
                      onChange={(v) => setOpening(o.key, { width: v })}
                      messages={msg("width")}
                    />
                    <NumberField
                      label="Height (Y)"
                      unit="in"
                      value={o.height}
                      onChange={(v) => setOpening(o.key, { height: v })}
                      messages={msg("height")}
                    />
                  </>
                )}
                {own.map((m) => (
                  <div
                    key={m.code}
                    className={`field-msg ${m.severity === "ERROR" ? "error" : "warning"}`}
                  >
                    {m.severity}: {m.message}
                  </div>
                ))}
              </div>
            );
          })}
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">Design assumptions</legend>
          <div className="row wide">
            <label htmlFor={ids.loc}>Column location</label>
            <select
              id={ids.loc}
              className="input"
              value={form.columnLocation}
              onChange={(e) => set("columnLocation", e.target.value as FormState["columnLocation"])}
            >
              <option value="interior">Interior</option>
              <option value="edge">Edge (not implemented)</option>
              <option value="corner">Corner (not implemented)</option>
            </select>
          </div>
          <div className="row wide">
            <label htmlFor={ids.reinf}>Shear reinforcement</label>
            <select
              id={ids.reinf}
              className="input"
              value={form.reinforcement}
              onChange={(e) => set("reinforcement", e.target.value as FormState["reinforcement"])}
            >
              <option value="none">None</option>
              <option value="studRails">Stud rails (not implemented)</option>
              <option value="stirrups">Stirrups (not implemented)</option>
            </select>
          </div>
          <label className="check">
            <input
              type="checkbox"
              checked={form.applySizeEffect}
              onChange={(e) => set("applySizeEffect", e.target.checked)}
            />
            <span>
              Apply size-effect factor λs (§22.5.5.1.3). Unchecking reproduces legacy calculations
              and is flagged as non-conforming.
            </span>
          </label>
        </fieldset>

        <div className="note">
          Yellow fields are editable. Every result, table, plan and 3D view updates instantly from
          the calculation engine.
        </div>
      </div>
    </aside>
  );
}
