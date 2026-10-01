import { useId } from "react";
import type { CalculationWarning } from "@civil/shared-types";

interface NumberFieldProps {
  label: string;
  unit: string;
  value: string;
  onChange: (value: string) => void;
  step?: string;
  messages?: CalculationWarning[] | undefined;
  hint?: string;
}

/** Editable numeric input (yellow) with unit and inline validation messages. */
export function NumberField({
  label,
  unit,
  value,
  onChange,
  step = "any",
  messages = [],
  hint,
}: NumberFieldProps) {
  const id = useId();
  const msgId = `${id}-msg`;
  const hasError = messages.some((m) => m.severity === "ERROR");
  return (
    <div className="row">
      <label htmlFor={id} title={hint}>
        {label}
      </label>
      <input
        id={id}
        className="input"
        type="number"
        inputMode="decimal"
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={hasError}
        aria-describedby={messages.length > 0 ? msgId : undefined}
      />
      <span className="unit">{unit}</span>
      {messages.length > 0 && (
        <div id={msgId} className="field-msg-wrap" style={{ gridColumn: "1 / -1" }}>
          {messages.map((m) => (
            <div
              key={m.code}
              className={`field-msg ${m.severity === "ERROR" ? "error" : "warning"}`}
            >
              {m.severity}: {m.message}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
