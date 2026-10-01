import type { Kpi } from "@/lib/calc";
import { Pane } from "../layout/Pane";

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <Pane id="kpis" flush>
      <div className="kpis" role="group" aria-label="Key results">
        {items.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="label">{k.label}</div>
            <div className="value" aria-live="polite">
              {k.value}
            </div>
            <div className="unit">{k.unit}</div>
          </div>
        ))}
      </div>
    </Pane>
  );
}
