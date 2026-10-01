import type {
  CalculationStep,
  CalculationUnavailable,
  CalculationWarning,
  PunchingCriticalPoint,
  PunchingShearOutcomeEC2,
  PunchingShearResultEC2,
  SegmentDto,
} from "@civil/shared-types";
import { validatePunchingInputEC2 } from "@civil/engineering-validation";
import { EN1992_1_1, EN1992_1_1_REFS as REFS } from "../codes/en1992-1-1";
import {
  intervalLength,
  mergeIntervals,
  openingAngularSpan,
  openingDistanceToRectangle,
  openingOverlapsRectangle,
  pieceToPoints,
  createRoundedPerimeter,
  roundedEffectivePieces,
  roundedOutline,
  roundedPiecesBetween,
  roundedProperties,
  roundedShadowIntervals,
  perimeterPointAtAngle,
} from "../geometry";
import type { PerimeterInterval } from "../geometry";
import { ENGINE_VERSION } from "../version";
import { betaBiaxial, betaKCoefficient, betaUniaxial } from "./ec2-beta";
import {
  designCompressiveStrength,
  maximumResistance,
  resistanceWithoutReinforcement,
  strengthReductionNu,
} from "./ec2-resistance";

const P = EN1992_1_1.punching;

export const PUNCHING_METHOD_EC2 =
  "EN 1992-1-1 two-way punching, interior rectangular column, no shear reinforcement, σcp = 0, recommended " +
  "National Annex values. Basic control perimeter at 2.0d with rounded corners (§6.4.2(1)); openings within 6d " +
  "removed between tangents from the column centre (§6.4.2(3)); vEd = β VEd/(u1 d) with β from (6.39) " +
  "(one axis, W1 = ∫|e| dl of the effective perimeter), (6.43) (both axes) or 1.0 (concentric); " +
  "vRd,c = max[CRd,c k (100 ρl fck)^(1/3), vmin] (6.47); column-face check vEd,0 <= vRd,max = 0.4 ν fcd (6.4.5(3)).";

/** Share of an unavailable outcome. */
function unavailable(
  reason: string,
  action: string,
  warnings: CalculationWarning[],
): CalculationUnavailable {
  return { ok: false, status: "UNAVAILABLE", reason, action, warnings };
}

function fmt(value: number, digits = 3): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(digits);
}

function toSegments(points: { x: number; y: number }[]): SegmentDto[] {
  return points.slice(1).map((p, i) => {
    const a = points[i] as { x: number; y: number };
    return { x1: a.x, y1: a.y, x2: p.x, y2: p.y };
  });
}

/** DCR limit for PASS. */
const DCR_LIMIT = 1;

/**
 * EN 1992-1-1 punching shear check. Pure function in canonical SI units (N, N·mm, mm, MPa).
 * Never returns a DCR for invalid geometry. EXPERIMENTAL: verified against the equations of the
 * standard and an independent numerical integration; no published numerical benchmark is available.
 */
export function calculatePunchingShearEC2(rawInput: unknown): PunchingShearOutcomeEC2 {
  const validation = validatePunchingInputEC2(rawInput);
  if (!validation.ok) {
    return unavailable(
      "Input validation failed.",
      "Correct the inputs marked ERROR and re-run the calculation.",
      validation.issues,
    );
  }
  const input = validation.input;
  const warnings: CalculationWarning[] = [...validation.issues];
  const steps: CalculationStep[] = [];
  const { c1, c2 } = input.column;
  const { VEd, d, fck } = input;
  const MEdx = Math.abs(input.MEdx);
  const MEdy = Math.abs(input.MEdy);

  warnings.push({
    severity: "WARNING",
    code: "EC2_EXPERIMENTAL",
    message:
      "The EN 1992-1-1 module is Experimental: checked against the equations of the standard and a numerical cross-check, not yet against a published numerical example. Verify before use.",
  });
  warnings.push({
    severity: "INFO",
    code: "EC2_NATIONAL_ANNEX",
    message: `Recommended values are used (γc = ${P.gammaC}, αcc = ${P.alphaCc}, CRd,c = ${P.cRdcNumerator}/γc, vRd,max = ${P.vRdMaxCoefficient} ν fcd, σcp = 0). A National Annex may change them; confirm for the project country.`,
    reference: REFS.gammaC,
  });
  warnings.push({
    severity: "INFO",
    code: "EC2_RHO_AVERAGING",
    message: `ρl must be the mean reinforcement ratio over the column width plus ${P.reinforcementWidthFactor}d each side (§6.4.4(1)); enter it accordingly.`,
    reference: REFS.resistance,
  });

  // 1. Basic control perimeter u1 (§6.4.2(1)).
  const radius = P.controlPerimeterFactor * d;
  const perimeter = createRoundedPerimeter(c1, c2, radius);
  const sizeX = c1 + 2 * radius;
  const sizeY = c2 + 2 * radius;
  steps.push({
    id: "control-perimeter",
    title: "Basic control perimeter u1 (gross)",
    formula: "u1 = 2 (c1 + c2) + 4π d",
    substitution: `u1 = 2 (${fmt(c1)} + ${fmt(c2)}) + 4π × ${fmt(d)}`,
    value: perimeter.length,
    unit: "mm",
    reference: REFS.controlPerimeter,
  });

  // 2. Openings within 6d (§6.4.2(3)).
  const hx = c1 / 2;
  const hy = c2 / 2;
  const influence = P.openingInfluenceFactor * d;
  const removed: PerimeterInterval[] = [];
  const openingReductions: PunchingShearResultEC2["geometry"]["openingReductions"] = [];
  const openingShadows: PunchingShearResultEC2["geometry"]["openingShadows"] = [];

  for (const [index, opening] of input.openings.entries()) {
    const label = `Opening ${index + 1}`;
    if (openingOverlapsRectangle(opening, hx, hy)) {
      return unavailable(
        `${label} overlaps the column.`,
        "Review opening location and size; an opening cannot intersect the column.",
        warnings,
      );
    }
    const span = openingAngularSpan(opening);
    if (!span) {
      return unavailable(
        `${label} geometry produces an invalid tangent solution (column centroid inside the opening).`,
        "Review opening location and size.",
        warnings,
      );
    }
    const distance = openingDistanceToRectangle(opening, hx, hy);
    if (distance > influence) {
      openingReductions.push({ openingIndex: index, reduction: 0, applied: false });
      warnings.push({
        severity: "INFO",
        code: "OPENING_BEYOND_6D",
        field: `openings.${index}`,
        message: `${label} is ${fmt(distance, 1)} mm from the column, more than 6d = ${fmt(influence, 1)} mm: not deducted from the control perimeter (§6.4.2(3)).`,
        reference: REFS.openings,
      });
      continue;
    }

    const intervals = roundedShadowIntervals(perimeter, span);
    const reduction = intervalLength(intervals);
    removed.push(...intervals);
    openingReductions.push({ openingIndex: index, reduction, applied: true });
    openingShadows.push({
      openingIndex: index,
      tangentStart: perimeterPointAtAngle(perimeter, span.from),
      tangentEnd: perimeterPointAtAngle(perimeter, span.to),
      removedSegments: intervals
        .flatMap((i) => roundedPiecesBetween(perimeter, i.start, i.end))
        .flatMap((piece) => toSegments(pieceToPoints(piece))),
    });
    if (distance < radius) {
      warnings.push({
        severity: "WARNING",
        code: "OPENING_INSIDE_CONTROL_PERIMETER_ZONE",
        field: `openings.${index}`,
        message: `${label} reaches the basic control perimeter (edge ${fmt(distance, 1)} mm from the column, 2d = ${fmt(radius, 1)} mm). The tangent rule is applied; review the opening geometry.`,
        reference: REFS.openings,
      });
    }
    steps.push({
      id: `opening-${index + 1}`,
      title: `${label} ineffective perimeter`,
      formula: "Length of u1 between tangents from the column centre to the opening outline",
      substitution: `${opening.type} at (${fmt(opening.centerX)}, ${fmt(opening.centerY)}) mm`,
      value: reduction,
      unit: "mm",
      reference: REFS.openings,
    });
  }

  // 3. Effective perimeter and its first moments.
  const merged = mergeIntervals(removed);
  const removedLength = intervalLength(merged);
  const pieces = roundedEffectivePieces(perimeter, merged);
  if (pieces.length === 0) {
    return unavailable(
      "Openings remove the entire control perimeter.",
      "Review opening locations and sizes.",
      warnings,
    );
  }
  const props = roundedProperties(pieces);
  const u1 = props.length;
  steps.push({
    id: "effective-perimeter",
    title: "Effective basic control perimeter u1",
    formula: "u1,eff = u1 − Σ ineffective lengths",
    substitution: `u1,eff = ${fmt(perimeter.length)} − ${fmt(removedLength)}`,
    value: u1,
    unit: "mm",
    reference: REFS.openings,
  });
  const u0 = 2 * (c1 + c2);
  steps.push({
    id: "column-perimeter",
    title: "Column perimeter u0 (interior column)",
    formula: "u0 = 2 (c1 + c2)",
    substitution: `u0 = 2 (${fmt(c1)} + ${fmt(c2)})`,
    value: u0,
    unit: "mm",
    reference: REFS.maxResistance,
  });
  if (Math.hypot(props.centroidX, props.centroidY) > 1e-6) {
    warnings.push({
      severity: "INFO",
      code: "CENTROID_SHIFT_MOMENT_NOT_INCLUDED",
      message: `The effective control perimeter centroid is offset (${fmt(props.centroidX, 2)}, ${fmt(props.centroidY, 2)}) mm from the column centre. The additional moment VEd·e is not added; review if significant.`,
      reference: REFS.beta,
    });
  }

  // 4. β (§6.4.3(3)).
  const eccentricityY = MEdx / VEd; // moment about X -> eccentricity along Y
  const eccentricityX = MEdy / VEd; // moment about Y -> eccentricity along X
  const hasX = MEdy > 0;
  const hasY = MEdx > 0;
  let beta = 1;
  let betaMethod: PunchingShearResultEC2["demand"]["betaMethod"] = "concentric";
  const reducedPerimeter = removedLength > 0;

  if (hasX && hasY) {
    beta = betaBiaxial(eccentricityX, eccentricityY, sizeX, sizeY);
    betaMethod = "6.43";
    steps.push({
      id: "beta",
      title: "β, eccentricity about both axes",
      formula: "β = 1 + 1.8 sqrt[(ey/bz)² + (ez/by)²]",
      substitution: `β = 1 + 1.8 sqrt[(${fmt(eccentricityX, 2)}/${fmt(sizeY, 1)})² + (${fmt(eccentricityY, 2)}/${fmt(sizeX, 1)})²]`,
      value: beta,
      unit: "-",
      reference: REFS.betaBiaxial,
    });
    if (reducedPerimeter) {
      warnings.push({
        severity: "WARNING",
        code: "BETA_BIAXIAL_IGNORES_OPENINGS",
        message:
          "Expression (6.43) uses the dimensions of the full control perimeter and does not account for openings. β is not reduced for the interrupted perimeter; review.",
        reference: REFS.betaBiaxial,
      });
    }
  } else if (hasX || hasY) {
    // Moment about Y -> eccentricity along X: c1 is parallel to the eccentricity; W1 about the Y axis.
    const parallel = hasX ? c1 : c2;
    const perpendicular = hasX ? c2 : c1;
    const moment = hasX ? MEdy : MEdx;
    const w1 = hasX ? props.absMomentAboutY : props.absMomentAboutX;
    const k = betaKCoefficient(parallel, perpendicular);
    beta = betaUniaxial(k, moment, VEd, u1, w1);
    betaMethod = "6.39";
    steps.push({
      id: "k",
      title: "k (Table 6.1)",
      formula: "k = f(c1/c2), c1 parallel to the eccentricity",
      substitution: `c1/c2 = ${fmt(parallel)}/${fmt(perpendicular)} = ${fmt(parallel / perpendicular, 3)}`,
      value: k,
      unit: "-",
      reference: REFS.kTable,
    });
    steps.push({
      id: "w1",
      title: "W1 = ∫|e| dl of the effective perimeter",
      formula: reducedPerimeter
        ? "W1 = ∫|e| dl (numerical, reduced perimeter)"
        : "W1 = c1²/2 + c1 c2 + 4 c2 d + 16 d² + 2π d c1",
      substitution: reducedPerimeter
        ? `W1 = ∫|${hasX ? "x − x̄" : "y − ȳ"}| dl over ${pieces.length} piece(s)`
        : `W1 = ${fmt(parallel)}²/2 + ${fmt(parallel)}·${fmt(perpendicular)} + 4·${fmt(perpendicular)}·${fmt(d)} + 16·${fmt(d)}² + 2π·${fmt(d)}·${fmt(parallel)}`,
      value: w1,
      unit: "mm²",
      reference: REFS.w1,
    });
    steps.push({
      id: "beta",
      title: "β, eccentricity about one axis",
      formula: "β = 1 + k (MEd/VEd)(u1/W1)",
      substitution: `β = 1 + ${fmt(k)} × (${fmt(moment)}/${fmt(VEd)}) × (${fmt(u1)}/${fmt(w1)})`,
      value: beta,
      unit: "-",
      reference: REFS.beta,
    });
    if (reducedPerimeter) {
      warnings.push({
        severity: "WARNING",
        code: "W1_GENERALIZED_FOR_OPENINGS",
        message:
          "With openings, W1 is the general integral ∫|e| dl of (6.40) over the reduced perimeter, measured from its centroid. The standard gives a closed form only for the full perimeter; review.",
        reference: REFS.w1,
      });
    }
  } else {
    steps.push({
      id: "beta",
      title: "β, no unbalanced moment",
      formula: "β = 1.0",
      substitution: "MEd = 0",
      value: beta,
      unit: "-",
      reference: REFS.beta,
    });
  }

  // 5. Design shear stresses.
  const vEd = (beta * VEd) / (u1 * d);
  const vEd0 = (beta * VEd) / (u0 * d);
  steps.push({
    id: "ved",
    title: "Design shear stress at u1",
    formula: "vEd = β VEd / (u1 d)",
    substitution: `vEd = ${fmt(beta, 4)} × ${fmt(VEd)} / (${fmt(u1)} × ${fmt(d)})`,
    value: vEd,
    unit: "MPa",
    reference: REFS.beta,
  });
  steps.push({
    id: "ved0",
    title: "Design shear stress at the column perimeter",
    formula: "vEd,0 = β VEd / (u0 d)",
    substitution: `vEd,0 = ${fmt(beta, 4)} × ${fmt(VEd)} / (${fmt(u0)} × ${fmt(d)})`,
    value: vEd0,
    unit: "MPa",
    reference: REFS.maxResistance,
  });

  // 6. Resistance (§6.4.4, §6.4.5(3)).
  const res = resistanceWithoutReinforcement({
    fck,
    dMm: d,
    rhoLx: input.rhoLx,
    rhoLy: input.rhoLy,
    gammaC: P.gammaC,
  });
  steps.push({
    id: "k-size",
    title: "Size factor k",
    formula: "k = 1 + sqrt(200/d) ≤ 2.0",
    substitution: `k = 1 + sqrt(200/${fmt(d)})`,
    value: res.k,
    unit: "-",
    reference: REFS.resistance,
  });
  steps.push({
    id: "rho",
    title: "Reinforcement ratio ρl",
    formula: "ρl = sqrt(ρlx ρly) ≤ 0.02",
    substitution: `ρl = sqrt(${fmt(input.rhoLx, 5)} × ${fmt(input.rhoLy, 5)})`,
    value: res.rhoL,
    unit: "-",
    reference: REFS.resistance,
  });
  steps.push({
    id: "vrdc-formula",
    title: "vRd,c expression (6.47)",
    formula: "CRd,c k (100 ρl fck)^(1/3), CRd,c = 0.18/γc",
    substitution: `${fmt(res.cRdc, 4)} × ${fmt(res.k, 4)} × (100 × ${fmt(res.rhoL, 5)} × ${fmt(fck)})^(1/3)`,
    value: res.vRdcFormula,
    unit: "MPa",
    reference: REFS.resistance,
  });
  steps.push({
    id: "vmin",
    title: "Minimum resistance vmin",
    formula: "vmin = 0.035 k^(3/2) fck^(1/2)",
    substitution: `vmin = 0.035 × ${fmt(res.k, 4)}^1.5 × ${fmt(fck)}^0.5`,
    value: res.vMin,
    unit: "MPa",
    reference: REFS.vMin,
  });
  steps.push({
    id: "vrdc",
    title: "Punching shear resistance vRd,c",
    formula: "vRd,c = max[(6.47), vmin]",
    substitution: `vRd,c = max[${fmt(res.vRdcFormula, 4)}, ${fmt(res.vMin, 4)}]`,
    value: res.vRdc,
    unit: "MPa",
    reference: REFS.resistance,
  });
  const nu = strengthReductionNu(fck);
  const fcd = designCompressiveStrength(fck, P.alphaCc, P.gammaC);
  const vRdMax = maximumResistance(fck, P.alphaCc, P.gammaC);
  steps.push({
    id: "vrdmax",
    title: "Maximum punching shear resistance vRd,max",
    formula: "vRd,max = 0.4 ν fcd, ν = 0.6 (1 − fck/250), fcd = αcc fck/γc",
    substitution: `vRd,max = 0.4 × ${fmt(nu, 4)} × ${fmt(fcd, 3)}`,
    value: vRdMax,
    unit: "MPa",
    reference: REFS.maxResistance,
  });

  // 7. Utilization.
  const dcrAtControlPerimeter = vEd / res.vRdc;
  const dcrAtColumnFace = vEd0 / vRdMax;
  const dcr = Math.max(dcrAtControlPerimeter, dcrAtColumnFace);
  const governsAtColumn = dcrAtColumnFace > dcrAtControlPerimeter;
  steps.push({
    id: "dcr-u1",
    title: "Utilization at the basic control perimeter",
    formula: "vEd / vRd,c",
    substitution: `${fmt(vEd, 4)} / ${fmt(res.vRdc, 4)}`,
    value: dcrAtControlPerimeter,
    unit: "-",
    reference: REFS.checks,
  });
  steps.push({
    id: "dcr-u0",
    title: "Utilization at the column perimeter",
    formula: "vEd,0 / vRd,max",
    substitution: `${fmt(vEd0, 4)} / ${fmt(vRdMax, 4)}`,
    value: dcrAtColumnFace,
    unit: "-",
    reference: REFS.checks,
  });
  steps.push({
    id: "dcr",
    title: "Demand / capacity ratio",
    formula: "DCR = max(vEd / vRd,c, vEd,0 / vRd,max)",
    substitution: `DCR = max(${fmt(dcrAtControlPerimeter, 4)}, ${fmt(dcrAtColumnFace, 4)})`,
    value: dcr,
    unit: "-",
    reference: REFS.checks,
  });
  if (dcrAtControlPerimeter > DCR_LIMIT && !governsAtColumn) {
    warnings.push({
      severity: "WARNING",
      code: "PUNCHING_REINFORCEMENT_REQUIRED",
      message:
        "vEd exceeds vRd,c: punching shear reinforcement would be required (§6.4.3(2)(c)). It is not implemented; increase the slab, the column size or the reinforcement ratio.",
      reference: REFS.checks,
    });
  }

  const numeric = [
    u1,
    u0,
    beta,
    vEd,
    vEd0,
    res.vRdc,
    vRdMax,
    dcr,
    props.absMomentAboutX,
    props.absMomentAboutY,
  ];
  if (numeric.some((v) => !Number.isFinite(v)) || u1 <= 0 || res.vRdc <= 0 || vRdMax <= 0) {
    return unavailable(
      "Calculation produced a non-finite or non-positive intermediate value.",
      "Review geometry and material inputs.",
      warnings,
    );
  }

  // Drawing data.
  const segments = pieces.flatMap((piece) => toSegments(pieceToPoints(piece)));
  const allPoints = pieces.flatMap((piece) => pieceToPoints(piece));
  const direction = { x: eccentricityX, y: eccentricityY };
  const hasDirection = Math.hypot(direction.x, direction.y) > 0;
  const critical = allPoints.reduce<{ score: number; x: number; y: number }>(
    (best, p) => {
      const score = hasDirection ? p.x * direction.x + p.y * direction.y : p.x;
      return score > best.score ? { score, x: p.x, y: p.y } : best;
    },
    { score: Number.NEGATIVE_INFINITY, x: 0, y: 0 },
  );
  const criticalPoint: PunchingCriticalPoint = { x: critical.x, y: critical.y, stress: vEd };
  const stressProfile: PunchingCriticalPoint[][] = pieces.map((piece) =>
    pieceToPoints(piece).map((p) => ({ x: p.x, y: p.y, stress: vEd })),
  );

  return {
    ok: true,
    status: dcr <= DCR_LIMIT ? "PASS" : "FAIL",
    demand: {
      beta,
      betaMethod,
      eccentricityX,
      eccentricityY,
      directShear: vEd,
      columnFaceShear: vEd0,
      maximumShearStress: vEd,
      criticalPoint,
      stressProfile,
    },
    geometry: {
      sizeX,
      sizeY,
      grossPerimeter: perimeter.length,
      openingReductions,
      effectivePerimeter: u1,
      columnPerimeter: u0,
      centroidX: props.centroidX,
      centroidY: props.centroidY,
      W1x: props.absMomentAboutX,
      W1y: props.absMomentAboutY,
      segments,
      grossOutline: roundedOutline(perimeter),
      openingShadows,
    },
    capacity: {
      k: res.k,
      rhoL: res.rhoL,
      cRdc: res.cRdc,
      vRdcFormula: res.vRdcFormula,
      vMin: res.vMin,
      vRdc: res.vRdc,
      governingExpression: res.governingExpression,
      nu,
      fcd,
      vRdMax,
      designStrength: res.vRdc,
    },
    dcr,
    dcrAtControlPerimeter,
    dcrAtColumnFace,
    governingCheck: governsAtColumn
      ? "Column perimeter, vEd,0 ≤ vRd,max (§6.4.5(3))"
      : `Control perimeter u1, vEd ≤ vRd,c (${res.governingExpression === "6.47" ? "6.47" : "vmin 6.3N"})`,
    steps,
    codeReferences: Object.values(REFS),
    warnings,
    meta: {
      module: "punching-shear",
      designCode: `${EN1992_1_1.code}:${EN1992_1_1.edition}`,
      engineVersion: ENGINE_VERSION,
      method: PUNCHING_METHOD_EC2,
    },
  };
}
