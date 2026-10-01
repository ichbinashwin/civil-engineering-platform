import type { PunchingShearOutcome } from "@civil/shared-types";
import { formatNumber, utilizationColor } from "@/lib/format";

/** Maximum DCR shown on the bar; tick marks DCR = 1.0 at 2/3 of the width. */
const BAR_MAX_DCR = 1.5;

export function ResultCard({ outcome }: { outcome: PunchingShearOutcome }) {
  if (!outcome.ok) {
    return (
      <div className="result-card unavailable" role="status" aria-live="polite">
        <div className="result-title">Punching shear</div>
        <div className="dcr">—</div>
        <p style={{ margin: "4px 0" }}>
          <span className="badge warn">CALCULATION UNAVAILABLE</span>
        </p>
        <p style={{ margin: "8px 0 4px" }}>
          <strong>Reason:</strong> {outcome.reason}
        </p>
        <p style={{ margin: 0 }}>
          <strong>Action:</strong> {outcome.action}
        </p>
      </div>
    );
  }
  const pass = outcome.status === "PASS";
  const width = `${Math.min(outcome.dcr / BAR_MAX_DCR, 1) * 100}%`;
  return (
    <div className={`result-card ${pass ? "" : "fail"}`} role="status" aria-live="polite">
      <div className="result-title">Punching shear · {outcome.governingCheck}</div>
      <div className="dcr" aria-label={`DCR ${formatNumber(outcome.dcr, 3)}`}>
        {formatNumber(outcome.dcr, 3)}
      </div>
      <div className="dcr-bar" aria-hidden="true">
        <span style={{ width, background: utilizationColor(outcome.dcr) }} />
        <i />
      </div>
      <div>
        <span className={`badge ${pass ? "pass" : "fail"}`}>{outcome.status}</span>{" "}
        <span className="num" style={{ fontFamily: "var(--mono)", fontSize: 13 }}>
          vu,max {formatNumber(outcome.demand.maximumShearStress, 1)} psi {pass ? "≤" : ">"} φvc{" "}
          {formatNumber(outcome.capacity.designStrength, 1)} psi
        </span>
      </div>
      <dl className="kv">
        <dt>Demand vu,max</dt>
        <dd>{formatNumber(outcome.demand.maximumShearStress, 1)} psi</dd>
        <dt>Capacity φvc</dt>
        <dd>{formatNumber(outcome.capacity.designStrength, 1)} psi</dd>
        <dt>Reserve</dt>
        <dd>{formatNumber((1 - outcome.dcr) * 100, 1)} %</dd>
      </dl>
      <div className="small" style={{ marginTop: 8 }}>
        DCR ≤ 1.00 → PASS. No punching shear reinforcement assumed.
      </div>
    </div>
  );
}
