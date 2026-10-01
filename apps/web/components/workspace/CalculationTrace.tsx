import type { CalculationStep } from "@civil/shared-types";
import { formatNumber } from "@/lib/format";
import { Pane } from "../layout/Pane";

/** Expandable step-by-step trace: formula, substitution, result, unit, provision. */
export function CalculationTrace({ steps }: { steps: CalculationStep[] }) {
  return (
    <Pane id="trace" badge={<span className="badge info">{steps.length} steps</span>}>
      <table>
        <caption className="sr-only">Calculation trace</caption>
        <thead>
          <tr>
            <th scope="col">#</th>
            <th scope="col" style={{ textAlign: "left" }}>
              Step / formula / substitution
            </th>
            <th scope="col">Result</th>
            <th scope="col">Ref.</th>
          </tr>
        </thead>
        <tbody>
          {steps.map((s, i) => (
            <tr key={s.id} style={{ verticalAlign: "top" }}>
              <td className="ref">{i + 1}</td>
              <td style={{ textAlign: "left" }}>
                <strong>{s.title}</strong>
                <div className="trace-formula">{s.formula}</div>
                <div className="trace-sub">{s.substitution}</div>
              </td>
              <td className="num" style={{ whiteSpace: "nowrap" }}>
                {formatNumber(s.value, 3)} {s.unit}
              </td>
              <td className="ref">{s.reference ? `§${s.reference.section}` : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Pane>
  );
}
