import type { PunchingShearResult, PunchingShearResultEC2 } from "@civil/shared-types";
import { formatNumber } from "@/lib/format";
import { Pane } from "../layout/Pane";

type Row = [label: string, value: string, unit: string, ref?: string, governing?: boolean];

function Table({ caption, rows }: { caption: string; rows: Row[] }) {
  return (
    <table>
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          <th scope="col">Parameter</th>
          <th scope="col">Value</th>
          <th scope="col">Unit</th>
          <th scope="col">Ref.</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([label, value, unit, ref, governing]) => (
          <tr key={label} className={governing ? "governing" : undefined}>
            <th scope="row" style={{ fontWeight: 500, textAlign: "left" }}>
              {label}
              {governing ? " (governs)" : ""}
            </th>
            <td className="num">{value}</td>
            <td>{unit}</td>
            <td className="ref">{ref ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function ResultTables({ result }: { result: PunchingShearResult }) {
  const { geometry: g, demand: dm, capacity: c } = result;
  const removed = g.grossPerimeter - g.effectivePerimeter;
  const geometryRows: Row[] = [
    ["Critical size X (c1 + d)", formatNumber(g.sizeX, 2), "in", "§22.6.4.1"],
    ["Critical size Y (c2 + d)", formatNumber(g.sizeY, 2), "in", "§22.6.4.1"],
    ["Gross perimeter", formatNumber(g.grossPerimeter, 3), "in", "§22.6.4.1"],
    ...g.openingReductions.map((o): Row => [
      `Opening ${o.openingIndex + 1} removed`,
      formatNumber(o.reduction, 3),
      "in",
      "§22.6.4.3",
    ]),
    ["Effective perimeter bo", formatNumber(g.effectivePerimeter, 3), "in", "§22.6.4.3"],
    ["Perimeter reduction", formatNumber((removed / g.grossPerimeter) * 100, 2), "%", ""],
    ["Centroid x̄", formatNumber(g.centroidX, 3), "in", ""],
    ["Centroid ȳ", formatNumber(g.centroidY, 3), "in", ""],
    ["Ix (line)", formatNumber(g.Ix, 0), "in³", ""],
    ["Iy (line)", formatNumber(g.Iy, 0), "in³", ""],
    ["Jx", formatNumber(g.Jx, 0), "in⁴", "R8.4.4.2.3"],
    ["Jy", formatNumber(g.Jy, 0), "in⁴", "R8.4.4.2.3"],
    ["Jxy (0 if symmetric)", formatNumber(g.Jxy, 1), "in⁴", "§8.4.4.2"],
  ];
  const demandRows: Row[] = [
    ["Direct shear vuv", formatNumber(dm.directShear, 2), "psi", "§8.4.4.2"],
    ["γvx (Mux)", formatNumber(dm.gammaVx, 3), "—", "§8.4.2.2"],
    ["γvy (Muy)", formatNumber(dm.gammaVy, 3), "—", "§8.4.2.2"],
    ["Stress from Mux", formatNumber(dm.momentX, 2), "psi", "§8.4.4.2"],
    ["Stress from Muy", formatNumber(dm.momentY, 2), "psi", "§8.4.4.2"],
    [
      "Critical point (x, y)",
      `${formatNumber(dm.criticalPoint.x, 2)}, ${formatNumber(dm.criticalPoint.y, 2)}`,
      "in",
      "",
    ],
    ["Maximum factored vu", formatNumber(dm.maximumShearStress, 2), "psi", "§8.4.4.2", true],
  ];
  const capacityRows: Row[] = [
    ["β (long/short column side)", formatNumber(c.betaC, 3), "—", "T22.6.5.2"],
    ["αs", formatNumber(c.alphaS, 0), "—", "T22.6.5.2"],
    ["λ", formatNumber(c.lambda, 2), "—", ""],
    ["λs", formatNumber(c.lambdaS, 3), "—", "§22.5.5.1.3"],
    ["√f'c (≤ 100)", formatNumber(c.sqrtFc, 2), "psi", "§22.6.3.1"],
    ["vc (a) 4λsλ√f'c", formatNumber(c.vcA, 1), "psi", "T22.6.5.2", c.governingEquation === "a"],
    [
      "vc (b) (2+4/β)λsλ√f'c",
      formatNumber(c.vcB, 1),
      "psi",
      "T22.6.5.2",
      c.governingEquation === "b",
    ],
    [
      "vc (c) (2+αs d/bo)λsλ√f'c",
      formatNumber(c.vcC, 1),
      "psi",
      "T22.6.5.2",
      c.governingEquation === "c",
    ],
    ["φ", formatNumber(c.phi, 2), "—", "T21.2.1"],
    ["φvc", formatNumber(c.designStrength, 1), "psi", "§22.6", true],
  ];
  return (
    <Pane
      id="tables"
      badge={<span className="badge info">{g.openingReductions.length} opening(s) assessed</span>}
    >
      <section aria-labelledby="geo-h" style={{ marginBottom: 18 }}>
        <h3 id="geo-h" className="section-title">
          Critical Section Geometry
        </h3>
        <Table caption="Critical section geometry" rows={geometryRows} />
      </section>
      <div className="tables">
        <section aria-labelledby="dem-h">
          <h3 id="dem-h" className="section-title">
            Punching Shear Demand
          </h3>
          <Table caption="Punching shear demand" rows={demandRows} />
        </section>
        <section aria-labelledby="cap-h">
          <h3 id="cap-h" className="section-title">
            ACI 318-19 Concrete Shear Strength
          </h3>
          <Table caption="Concrete shear strength" rows={capacityRows} />
        </section>
      </div>
    </Pane>
  );
}

/** EN 1992-1-1 tables: control perimeter, demand (β, vEd) and resistance (vRd,c, vmin, vRd,max). */
export function ResultTablesEC2({ result }: { result: PunchingShearResultEC2 }) {
  const { geometry: g, demand: dm, capacity: c } = result;
  const removed = g.grossPerimeter - g.effectivePerimeter;
  const geometryRows: Row[] = [
    ["Control size by = c1 + 4d", formatNumber(g.sizeX, 1), "mm", "6.4.2(1)"],
    ["Control size bz = c2 + 4d", formatNumber(g.sizeY, 1), "mm", "6.4.2(1)"],
    ["Gross control perimeter u1", formatNumber(g.grossPerimeter, 1), "mm", "6.4.2(1)"],
    ...g.openingReductions.map((o): Row => [
      `Opening ${o.openingIndex + 1} ${o.applied ? "removed" : "(beyond 6d, ignored)"}`,
      formatNumber(o.reduction, 1),
      "mm",
      "6.4.2(3)",
    ]),
    ["Effective perimeter u1", formatNumber(g.effectivePerimeter, 1), "mm", "6.4.2(3)", true],
    ["Perimeter reduction", formatNumber((removed / g.grossPerimeter) * 100, 2), "%", ""],
    ["Column perimeter u0", formatNumber(g.columnPerimeter, 1), "mm", "6.4.5(3)"],
    ["Centroid x̄", formatNumber(g.centroidX, 2), "mm", ""],
    ["Centroid ȳ", formatNumber(g.centroidY, 2), "mm", ""],
    ["W1 about X (for MEdx)", formatNumber(g.W1x, 0), "mm²", "(6.40)"],
    ["W1 about Y (for MEdy)", formatNumber(g.W1y, 0), "mm²", "(6.40)"],
  ];
  const demandRows: Row[] = [
    ["Eccentricity eY = MEdx/VEd", formatNumber(dm.eccentricityY, 2), "mm", "6.4.3(3)"],
    ["Eccentricity eX = MEdy/VEd", formatNumber(dm.eccentricityX, 2), "mm", "6.4.3(3)"],
    ["β method", dm.betaMethod === "concentric" ? "β = 1.0" : `(${dm.betaMethod})`, "", "6.4.3(3)"],
    ["β", formatNumber(dm.beta, 4), "—", "6.4.3(3)"],
    ["vEd at u1", formatNumber(dm.directShear, 3), "MPa", "(6.38)", true],
    ["vEd,0 at u0", formatNumber(dm.columnFaceShear, 3), "MPa", "6.4.5(3)"],
  ];
  const capacityRows: Row[] = [
    ["k = 1 + √(200/d) ≤ 2.0", formatNumber(c.k, 4), "—", "6.4.4(1)"],
    ["ρl = √(ρlx ρly) ≤ 0.02", formatNumber(c.rhoL, 5), "—", "6.4.4(1)"],
    ["CRd,c = 0.18/γc", formatNumber(c.cRdc, 4), "—", "6.4.4(1)"],
    [
      "CRd,c k (100 ρl fck)^⅓",
      formatNumber(c.vRdcFormula, 3),
      "MPa",
      "(6.47)",
      c.governingExpression === "6.47",
    ],
    [
      "vmin = 0.035 k^(3/2) fck^(1/2)",
      formatNumber(c.vMin, 3),
      "MPa",
      "(6.3N)",
      c.governingExpression === "6.3N",
    ],
    ["vRd,c", formatNumber(c.vRdc, 3), "MPa", "(6.47)", true],
    ["ν = 0.6 (1 − fck/250)", formatNumber(c.nu, 4), "—", "(6.6N)"],
    ["fcd = αcc fck/γc", formatNumber(c.fcd, 2), "MPa", "(3.15)"],
    ["vRd,max = 0.4 ν fcd", formatNumber(c.vRdMax, 3), "MPa", "6.4.5(3)", true],
    ["vEd / vRd,c at u1", formatNumber(result.dcrAtControlPerimeter, 3), "—", "6.4.3(2)"],
    ["vEd,0 / vRd,max at column", formatNumber(result.dcrAtColumnFace, 3), "—", "6.4.3(2)"],
  ];
  return (
    <Pane
      id="tables"
      badge={
        <span className="badge info">
          {g.openingReductions.filter((o) => o.applied).length} opening(s) within 6d
        </span>
      }
    >
      <section aria-labelledby="geo-h" style={{ marginBottom: 18 }}>
        <h3 id="geo-h" className="section-title">
          Basic Control Perimeter
        </h3>
        <Table caption="Basic control perimeter" rows={geometryRows} />
      </section>
      <div className="tables">
        <section aria-labelledby="dem-h">
          <h3 id="dem-h" className="section-title">
            Punching Shear Demand
          </h3>
          <Table caption="Punching shear demand" rows={demandRows} />
        </section>
        <section aria-labelledby="cap-h">
          <h3 id="cap-h" className="section-title">
            EN 1992-1-1 Shear Resistance
          </h3>
          <Table caption="Shear resistance" rows={capacityRows} />
        </section>
      </div>
    </Pane>
  );
}
