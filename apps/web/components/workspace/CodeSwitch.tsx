"use client";

import type { DesignCode } from "@civil/shared-types";
import { CODE_LABELS } from "@/lib/calc";
import { DESIGN_CODES, UNIT_SYSTEMS } from "@/lib/form";

/** Five-point star polygon centred at (cx, cy). */
function star(cx: number, cy: number, outer: number): string {
  const inner = outer * 0.4;
  return Array.from({ length: 10 }, (_, i) => {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(" ");
}

const FLAG_WIDTH = 24;
const FLAG_HEIGHT = 16;

/** United States flag (simplified canton), inline SVG so it renders on every platform. */
export function FlagUS() {
  const stripe = FLAG_HEIGHT / 13;
  return (
    <svg
      width={FLAG_WIDTH}
      height={FLAG_HEIGHT}
      viewBox={`0 0 ${FLAG_WIDTH} ${FLAG_HEIGHT}`}
      role="img"
      aria-label="United States flag"
      className="flag"
    >
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#ffffff" />
      {Array.from({ length: 7 }, (_, i) => (
        <rect key={i} y={i * 2 * stripe} width={FLAG_WIDTH} height={stripe} fill="#b22234" />
      ))}
      <rect width="10" height={stripe * 7} fill="#3c3b6e" />
      {[0, 1, 2].flatMap((row) =>
        [0, 1, 2, 3].map((col) => (
          <circle
            key={`${row}-${col}`}
            cx={1.8 + col * 2.4}
            cy={1.6 + row * 2.4}
            r="0.55"
            fill="#ffffff"
          />
        )),
      )}
    </svg>
  );
}

/** European Union flag: twelve gold stars on blue. */
export function FlagEU() {
  return (
    <svg
      width={FLAG_WIDTH}
      height={FLAG_HEIGHT}
      viewBox={`0 0 ${FLAG_WIDTH} ${FLAG_HEIGHT}`}
      role="img"
      aria-label="European Union flag"
      className="flag"
    >
      <rect width={FLAG_WIDTH} height={FLAG_HEIGHT} fill="#003399" />
      {Array.from({ length: 12 }, (_, i) => {
        const a = (Math.PI / 6) * i;
        return (
          <polygon
            key={i}
            points={star(
              FLAG_WIDTH / 2 + 5.4 * Math.cos(a),
              FLAG_HEIGHT / 2 + 5.4 * Math.sin(a),
              1.3,
            )}
            fill="#ffcc00"
          />
        );
      })}
    </svg>
  );
}

interface CodeSwitchProps {
  code: DesignCode;
  onChange: (code: DesignCode) => void;
}

/** Header switch between the US (ACI 318-19) and EU (EN 1992-1-1) design codes. */
export function CodeSwitch({ code, onChange }: CodeSwitchProps) {
  return (
    <div className="code-switch" role="radiogroup" aria-label="Design code">
      {DESIGN_CODES.map((c) => {
        const info = CODE_LABELS[c];
        const units = UNIT_SYSTEMS[c];
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={code === c}
            title={`${info.region} — ${info.short}: ${units.force}, ${units.momentLabel}, ${units.length}, ${units.stress}${c === "EN 1992-1-1" ? " (Experimental)" : ""}`}
            onClick={() => onChange(c)}
          >
            {c === "ACI 318-19" ? <FlagUS /> : <FlagEU />}
            <span>
              <b>{info.region}</b> {info.short}
            </span>
          </button>
        );
      })}
    </div>
  );
}
