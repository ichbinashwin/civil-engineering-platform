import type { PunchingShearOutcome } from "@civil/shared-types";
import { formatNumber } from "@/lib/format";

export function KpiStrip({ outcome }: { outcome: PunchingShearOutcome }) {
  const r = outcome.ok ? outcome : null;
  const items = [
    {
      label: "Effective perimeter bo",
      value: r ? formatNumber(r.geometry.effectivePerimeter, 2) : "—",
      unit: "in",
    },
    {
      label: "Maximum vu",
      value: r ? formatNumber(r.demand.maximumShearStress, 1) : "—",
      unit: "psi",
    },
    {
      label: "Design φvc",
      value: r ? formatNumber(r.capacity.designStrength, 1) : "—",
      unit: "psi",
    },
    { label: "DCR", value: r ? formatNumber(r.dcr, 3) : "—", unit: r ? r.status : "unavailable" },
  ];
  return (
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
  );
}
