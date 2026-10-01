import { useId } from "react";
import type { CalculationWarning } from "@civil/shared-types";
import { UNIT_SYSTEMS, createOpening } from "@/lib/form";
import { CODE_LABELS } from "@/lib/calc";
import type { FormState, NumericField, OpeningForm } from "@/lib/form";
import { Pane } from "../layout/Pane";
import { NumberField } from "./NumberField";

interface InputPanelProps {
  form: FormState;
  onChange: (next: FormState) => void;
  messages: Map<string, CalculationWarning[]>;
  selectedOpening: string | null;
  onSelectOpening: (key: string | null) => void;
}

interface FieldDef {
  field: NumericField;
  label: string;
  unit: string;
}

/** Field labels and units follow the selected design code (US: kip, kip-ft, in / EU: kN, kN·m, mm). */
function actionFields(form: FormState): FieldDef[] {
  const u = UNIT_SYSTEMS[form.code];
  return form.code === "EN 1992-1-1"
    ? [
        { field: "Vu", label: "VEd (design shear)", unit: u.force },
        { field: "Mux", label: "MEdx (about X)", unit: u.momentLabel },
        { field: "Muy", label: "MEdy (about Y)", unit: u.momentLabel },
      ]
    : [
        { field: "Vu", label: "Vu (factored shear)", unit: u.force },
        { field: "Mux", label: "Mux (about X)", unit: u.momentLabel },
        { field: "Muy", label: "Muy (about Y)", unit: u.momentLabel },
      ];
}

function geometryFields(form: FormState): FieldDef[] {
  const unit = UNIT_SYSTEMS[form.code].length;
  return [
    { field: "c1", label: "c1 (column, X)", unit },
    { field: "c2", label: "c2 (column, Y)", unit },
    {
      field: "d",
      label: form.code === "EN 1992-1-1" ? "Mean effective depth d" : "Effective depth d",
      unit,
    },
    { field: "h", label: "Slab thickness h", unit },
  ];
}

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
    sign: useId(),
  };
  const units = UNIT_SYSTEMS[form.code];
  const isEc2 = form.code === "EN 1992-1-1";
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
    <Pane id="inputs" badge={<span className="badge info">Editable</span>}>
      <div>
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
              {CODE_LABELS[form.code].short} ({CODE_LABELS[form.code].region} · {units.force},{" "}
              {units.length})
            </span>
          </div>
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">Factored actions</legend>
          {actionFields(form).map((a) => field(a.field, a.label, a.unit))}
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">Column / slab geometry</legend>
          {geometryFields(form).map((g) => field(g.field, g.label, g.unit))}
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">Material</legend>
          {isEc2 ? (
            <>
              {field("fc", "fck (cylinder strength)", "MPa", "5")}
              {field("rhoX", "ρlx (tension steel, X)", "%", "0.05")}
              {field("rhoY", "ρly (tension steel, Y)", "%", "0.05")}
              <p className="small" style={{ margin: "4px 0 0" }}>
                ρl: mean ratio over the column width + 3d each side (§6.4.4(1)).
              </p>
            </>
          ) : (
            <>
              {field("fc", "f'c", "psi", "250")}
              {field("lambda", "λ (lightweight factor)", "—", "0.05")}
            </>
          )}
        </fieldset>

        <fieldset className="group">
          <legend className="group-title">
            Openings ({form.openings.length})
            <button
              type="button"
              className="btn small"
              onClick={() => set("openings", [...form.openings, createOpening(form.code)])}
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
                  unit={units.length}
                  value={o.x}
                  onChange={(v) => setOpening(o.key, { x: v })}
                  messages={msg("x")}
                />
                <NumberField
                  label="Center Y"
                  unit={units.length}
                  value={o.y}
                  onChange={(v) => setOpening(o.key, { y: v })}
                  messages={msg("y")}
                />
                {o.type === "circle" ? (
                  <NumberField
                    label="Diameter"
                    unit={units.length}
                    value={o.diameter}
                    onChange={(v) => setOpening(o.key, { diameter: v })}
                    messages={msg("diameter")}
                  />
                ) : (
                  <>
                    <NumberField
                      label="Width (X)"
                      unit={units.length}
                      value={o.width}
                      onChange={(v) => setOpening(o.key, { width: v })}
                      messages={msg("width")}
                    />
                    <NumberField
                      label="Height (Y)"
                      unit={units.length}
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
          {isEc2 ? (
            <p className="small" style={{ margin: "4px 0 0" }}>
              EN 1992-1-1: β is a magnitude (moment signs do not matter); recommended National Annex
              values; σcp = 0.
            </p>
          ) : (
            <>
              <div className="row wide">
                <label
                  htmlFor={ids.sign}
                  title="Envelope: worst sign of each moment (conservative). Signed: positive Mux raises stress on +y, positive Muy on +x."
                >
                  Moment signs
                </label>
                <select
                  id={ids.sign}
                  className="input"
                  value={form.momentSign}
                  onChange={(e) => set("momentSign", e.target.value as FormState["momentSign"])}
                >
                  <option value="envelope">Envelope (conservative)</option>
                  <option value="signed">Signed (as entered)</option>
                </select>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={form.applySizeEffect}
                  onChange={(e) => set("applySizeEffect", e.target.checked)}
                />
                <span>
                  Apply size-effect factor λs (§22.5.5.1.3). Unchecking reproduces legacy
                  calculations and is flagged as non-conforming.
                </span>
              </label>
            </>
          )}
        </fieldset>

        <div className="note">
          Yellow fields are editable. Every result, table, plan and 3D view updates instantly from
          the calculation engine.
        </div>
      </div>
    </Pane>
  );
}
