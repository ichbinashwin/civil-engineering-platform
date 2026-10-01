import { calculatePunchingShear } from "@civil/engineering-core";
import { CalculationTrace } from "@/components/CalculationTrace";
import { EngineeringDisclaimer } from "@/components/EngineeringDisclaimer";
import { StatusBadge } from "@/components/StatusBadge";
import { formatNumber } from "@/lib/format";
import { REFERENCE_INPUT } from "@/lib/reference-case";

/**
 * Milestone 1 smoke page: renders the engine result for the reference case.
 * The interactive input dashboard is Milestone 2.
 */
export default function HomePage() {
  const result = calculatePunchingShear(REFERENCE_INPUT);

  return (
    <main className="mx-auto max-w-6xl px-6 py-6">
      <header className="mb-6 flex items-baseline justify-between border-b border-rule pb-3">
        <h1 className="text-lg font-semibold tracking-tight">Civil Engineering Platform</h1>
        <span className="font-mono text-xs text-muted">
          ACI 318-19 · Two-way punching shear · Reference case
        </span>
      </header>

      {!result.ok ? (
        <section aria-labelledby="unavailable" className="border border-fail p-4">
          <h2 id="unavailable" className="font-semibold text-fail">
            Calculation unavailable
          </h2>
          <p>Reason: {result.reason}</p>
          <p>Action: {result.action}</p>
        </section>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <section aria-labelledby="trace-heading">
            <h2
              id="trace-heading"
              className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted"
            >
              Calculation trace
            </h2>
            <CalculationTrace steps={result.steps} />
          </section>

          <aside aria-labelledby="result-heading" className="border border-rule bg-panel p-4">
            <h2
              id="result-heading"
              className="text-sm font-semibold uppercase tracking-wide text-muted"
            >
              Punching shear
            </h2>
            <p
              className="mt-3 font-mono text-5xl font-semibold"
              aria-label={`DCR ${formatNumber(result.dcr, 2)}`}
            >
              {formatNumber(result.dcr, 2)}
            </p>
            <p className="mb-3 text-xs text-muted">DCR = vu,max / φvc</p>
            <StatusBadge status={result.status} />
            <dl className="mt-4 grid grid-cols-2 gap-y-1 font-mono text-sm">
              <dt className="text-muted">Demand</dt>
              <dd className="text-right">
                {formatNumber(result.demand.maximumShearStress, 1)} psi
              </dd>
              <dt className="text-muted">Capacity φvc</dt>
              <dd className="text-right">{formatNumber(result.capacity.designStrength, 1)} psi</dd>
              <dt className="text-muted">bo,eff</dt>
              <dd className="text-right">
                {formatNumber(result.geometry.effectivePerimeter, 3)} in
              </dd>
            </dl>
            <p className="mt-3 text-xs text-muted">{result.governingCheck}</p>
            {result.warnings.length > 0 && (
              <ul className="mt-4 space-y-2 text-xs">
                {result.warnings.map((w) => (
                  <li key={w.code}>
                    <strong className={w.severity === "WARNING" ? "text-warn" : "text-muted"}>
                      {w.severity}
                    </strong>{" "}
                    {w.message}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-4 font-mono text-[10px] text-muted">
              {result.meta.designCode} · engine v{result.meta.engineVersion}
            </p>
          </aside>
        </div>
      )}

      <footer className="mt-8">
        <EngineeringDisclaimer />
      </footer>
    </main>
  );
}
