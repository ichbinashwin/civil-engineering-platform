import type { Calc } from "@/lib/calc";
import { summaryOf } from "@/lib/calc";
import { formatNumber, utilizationColor } from "@/lib/format";

/** Maximum DCR shown on the bar; tick marks DCR = 1.0 at 2/3 of the width. */
const BAR_MAX_DCR = 1.5;

export function ResultCard({ calc }: { calc: Calc }) {
  const summary = summaryOf(calc);
  if (!summary || !calc.outcome.ok) {
    const unavailable = calc.outcome.ok ? null : calc.outcome;
    return (
      <div className="result-card unavailable" role="status" aria-live="polite">
        <div className="result-title">Punching shear</div>
        <div className="dcr">—</div>
        <p style={{ margin: "4px 0" }}>
          <span className="badge warn">CALCULATION UNAVAILABLE</span>
        </p>
        <p style={{ margin: "8px 0 4px" }}>
          <strong>Reason:</strong> {unavailable?.reason}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Action:</strong> {unavailable?.action}
        </p>
      </div>
    );
  }
  const pass = summary.status === "PASS";
  const width = `${Math.min(summary.dcr / BAR_MAX_DCR, 1) * 100}%`;
  const fmt = (v: number) => formatNumber(v, summary.digits);
  return (
    <div className={`result-card ${pass ? "" : "fail"}`} role="status" aria-live="polite">
      <div className="result-title">Punching shear · {summary.governingCheck}</div>
      <div className="dcr" aria-label={`DCR ${formatNumber(summary.dcr, 3)}`}>
        {formatNumber(summary.dcr, 3)}
      </div>
      <div className="dcr-bar" aria-hidden="true">
        <span style={{ width, background: utilizationColor(summary.dcr) }} />
        <i />
      </div>
      <div>
        <span className={`badge ${pass ? "pass" : "fail"}`}>{summary.status}</span>{" "}
        <span className="num" style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
          {summary.demandLabel} {fmt(summary.demand)} {summary.unit} {pass ? "≤" : ">"}{" "}
          {summary.capacityLabel} {fmt(summary.capacity)} {summary.unit}
        </span>
      </div>
      <dl className="kv">
        <dt>Demand {summary.demandLabel}</dt>
        <dd>
          {fmt(summary.demand)} {summary.unit}
        </dd>
        <dt>Capacity {summary.capacityLabel}</dt>
        <dd>
          {fmt(summary.capacity)} {summary.unit}
        </dd>
        <dt>Reserve</dt>
        <dd>{formatNumber((1 - summary.dcr) * 100, 1)} %</dd>
      </dl>
      <div className="small" style={{ marginTop: 8 }}>
        {summary.note}
      </div>
    </div>
  );
}
