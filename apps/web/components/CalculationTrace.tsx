import type { CalculationStep } from "@civil/shared-types";
import { formatNumber } from "@/lib/format";

export function CalculationTrace({ steps }: { steps: CalculationStep[] }) {
  return (
    <table className="w-full border-collapse text-sm">
      <caption className="sr-only">
        Calculation trace: formula, substitution, result and code reference
      </caption>
      <thead>
        <tr className="border-b border-rule text-left text-muted">
          <th scope="col" className="py-2 pr-4 font-medium">
            #
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Step
          </th>
          <th scope="col" className="py-2 pr-4 font-medium">
            Formula / substitution
          </th>
          <th scope="col" className="py-2 pr-4 text-right font-medium">
            Result
          </th>
          <th scope="col" className="py-2 font-medium">
            Ref.
          </th>
        </tr>
      </thead>
      <tbody>
        {steps.map((step, i) => (
          <tr key={step.id} className="border-b border-rule align-top">
            <td className="py-2 pr-4 font-mono text-muted">{i + 1}</td>
            <th scope="row" className="py-2 pr-4 text-left font-medium">
              {step.title}
            </th>
            <td className="py-2 pr-4 font-mono text-xs">
              <div>{step.formula}</div>
              <div className="text-muted">{step.substitution}</div>
            </td>
            <td className="py-2 pr-4 text-right font-mono whitespace-nowrap">
              {formatNumber(step.value, 3)} {step.unit}
            </td>
            <td className="py-2 font-mono text-xs text-muted">
              {step.reference ? `§${step.reference.section}` : ""}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
