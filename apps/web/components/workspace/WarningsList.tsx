import type { CalculationWarning } from "@civil/shared-types";

const BADGE: Record<CalculationWarning["severity"], string> = {
  ERROR: "fail",
  WARNING: "warn",
  INFO: "info",
};
const ORDER: Record<CalculationWarning["severity"], number> = { ERROR: 0, WARNING: 1, INFO: 2 };

export function WarningsList({ warnings }: { warnings: CalculationWarning[] }) {
  const sorted = [...warnings].sort((a, b) => ORDER[a.severity] - ORDER[b.severity]);
  return (
    <section className="panel" aria-labelledby="warn-h">
      <h2 id="warn-h">
        Engineering messages <span className="badge info">{warnings.length}</span>
      </h2>
      <div className="panel-body">
        {sorted.length === 0 ? (
          <p className="small" style={{ margin: 0 }}>
            No warnings.
          </p>
        ) : (
          <ul className="warnings">
            {sorted.map((w, i) => (
              <li key={`${w.code}-${i}`}>
                <span className={`badge ${BADGE[w.severity]}`}>{w.severity}</span>
                <span>
                  {w.message}
                  {w.reference && <span className="ref"> §{w.reference.section}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
