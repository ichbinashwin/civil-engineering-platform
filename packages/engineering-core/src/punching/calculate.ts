import type {
  CalculationStep,
  CalculationUnavailable,
  CalculationWarning,
  PunchingShearOutcome,
  PunchingShearResult,
} from "@civil/shared-types";
import { validatePunchingInput } from "@civil/engineering-validation";
import { ACI318_19, ACI318_19_REFS as REFS } from "../codes/aci318-19";
import {
  createRectangularPerimeter,
  criticalSectionProperties,
  effectiveSegments,
  intervalLength,
  mergeIntervals,
  openingAngularSpan,
  openingCrossesPerimeter,
  openingDistanceToRectangle,
  openingOverlapsRectangle,
  shadowIntervals,
} from "../geometry";
import type { PerimeterInterval, Segment } from "../geometry";
import { ENGINE_VERSION } from "../version";
import { concreteCapacity, sizeEffectFactor } from "./capacity";
import { momentTransferFractionShear } from "./moment-transfer";

const TWS = ACI318_19.twoWayShear;

/**
 * Description of the implemented method, recorded in every result.
 * Software-level choices (not code provisions) are stated explicitly so they can be reviewed.
 */
export const PUNCHING_METHOD =
  "ACI 318-19 two-way shear, interior rectangular column, no shear reinforcement. " +
  "Critical section at d/2 (§22.6.4.1). Opening shadows by tangent lines from the column centroid (§22.6.4.3), " +
  "overlapping shadows merged. Section properties of the effective (reduced) perimeter about its own centroid. " +
  "Shear stress vu = Vu/(bo d) + gamma_vx |Mux| |y - yc| / Jx + gamma_vy |Muy| |x - xc| / Jy evaluated at every " +
  "effective-segment end point (sign envelope, §8.4.4.2). gamma_v from gross critical-section b1/b2 (§8.4.2.2.2).";

/**
 * Software review threshold, not a code provision: openings whose edge is within this
 * fraction of d from the critical perimeter are flagged for engineer review.
 */
const OPENING_PROXIMITY_REVIEW_FACTOR = 0.5;

/** DCR limit for PASS. */
const DCR_LIMIT = 1;

function fmt(value: number, digits = 3): string {
  return Number.isInteger(value) ? value.toString() : value.toFixed(digits);
}

function unavailable(
  reason: string,
  action: string,
  warnings: CalculationWarning[],
): CalculationUnavailable {
  return { ok: false, status: "UNAVAILABLE", reason, action, warnings };
}

function allFinite(values: number[]): boolean {
  return values.every((v) => Number.isFinite(v));
}

/**
 * ACI 318-19 two-way punching shear check. Pure function: no I/O, deterministic.
 * Input in canonical units (lb, in, lb-in, psi). Never returns a DCR for invalid geometry.
 */
export function calculatePunchingShear(rawInput: unknown): PunchingShearOutcome {
  const validation = validatePunchingInput(rawInput);
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
  const { d, Vu, Mux, Muy } = input;
  const h = input.slabThickness;
  const applySizeEffect = input.options?.applySizeEffectFactor ?? true;

  // 1. Gross critical section (§22.6.4.1): offset d/2 from column faces.
  const offset = TWS.criticalSectionOffsetFactor * d;
  const sizeX = c1 + 2 * offset;
  const sizeY = c2 + 2 * offset;
  const perimeter = createRectangularPerimeter(sizeX, sizeY);
  steps.push({
    id: "gross-perimeter",
    title: "Gross critical perimeter",
    formula: "bo = 2[(c1 + d) + (c2 + d)]",
    substitution: `bo = 2[(${fmt(c1)} + ${fmt(d)}) + (${fmt(c2)} + ${fmt(d)})]`,
    value: perimeter.length,
    unit: "in",
    reference: REFS.criticalSectionLocation,
  });

  // 2. Openings (§22.6.4.3).
  const columnHalfX = c1 / 2;
  const columnHalfY = c2 / 2;
  const influenceDistance = TWS.openingInfluenceHeightFactor * h;
  const removed: PerimeterInterval[] = [];
  const openingReductions: PunchingShearResult["geometry"]["openingReductions"] = [];

  for (const [index, opening] of input.openings.entries()) {
    const label = `Opening ${index + 1}`;
    if (openingOverlapsRectangle(opening, columnHalfX, columnHalfY)) {
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

    const intervals = shadowIntervals(perimeter, span);
    const reduction = intervalLength(intervals);
    removed.push(...intervals);
    openingReductions.push({ openingIndex: index, reduction, applied: true });

    if (openingCrossesPerimeter(opening, perimeter)) {
      warnings.push({
        severity: "WARNING",
        code: "OPENING_CROSSES_CRITICAL_SECTION",
        field: `openings.${index}`,
        message: `${label} intersects the critical perimeter. Tangent-line reduction applied; review ACI 318-19 opening provisions.`,
        reference: REFS.openings,
      });
    } else if (
      openingDistanceToRectangle(opening, perimeter.halfX, perimeter.halfY) <
      OPENING_PROXIMITY_REVIEW_FACTOR * d
    ) {
      warnings.push({
        severity: "WARNING",
        code: "OPENING_NEAR_CRITICAL_SECTION",
        field: `openings.${index}`,
        message: `${label} is close to the critical punching perimeter. Review ACI 318-19 opening provisions.`,
        reference: REFS.openings,
      });
    }

    if (openingDistanceToRectangle(opening, columnHalfX, columnHalfY) > influenceDistance) {
      warnings.push({
        severity: "INFO",
        code: "OPENING_BEYOND_4H",
        field: `openings.${index}`,
        message: `${label} is farther than 4h = ${fmt(influenceDistance, 1)} in from the column. Reduction applied conservatively; §22.6.4.3 requires it only if the opening is within the column strip or within 4h.`,
        reference: REFS.openings,
      });
    }

    steps.push({
      id: `opening-${index + 1}`,
      title: `${label} ineffective perimeter`,
      formula: "Length of bo between tangent lines from column centroid to opening boundary",
      substitution: `${opening.type} at (${fmt(opening.centerX)}, ${fmt(opening.centerY)}) in`,
      value: reduction,
      unit: "in",
      reference: REFS.openings,
    });
  }

  // 3. Effective perimeter and section properties (overlapping shadows counted once).
  const removedLength = intervalLength(mergeIntervals(removed));
  const segments: Segment[] = effectiveSegments(perimeter, removed);
  if (segments.length === 0) {
    return unavailable(
      "Openings remove the entire critical perimeter.",
      "Review opening locations and sizes.",
      warnings,
    );
  }
  const props = criticalSectionProperties(segments, d);
  const bo = props.perimeter;
  steps.push({
    id: "effective-perimeter",
    title: "Effective critical perimeter",
    formula: "bo,eff = bo - sum(ineffective lengths)",
    substitution: `bo,eff = ${fmt(perimeter.length)} - ${fmt(removedLength)}`,
    value: bo,
    unit: "in",
    reference: REFS.openings,
  });
  steps.push({
    id: "centroid",
    title: "Critical-section centroid offset (x, y)",
    formula: "xc = sum(L xm)/bo, yc = sum(L ym)/bo",
    substitution: `xc = ${fmt(props.centroidX, 4)} in, yc = ${fmt(props.centroidY, 4)} in`,
    value: Math.hypot(props.centroidX, props.centroidY),
    unit: "in",
    reference: REFS.shearStressFromMoment,
  });
  steps.push({
    id: "jx",
    title: "Jx (moment about X)",
    formula: "Jx = d sum(L/3 (ya^2 + ya yb + yb^2)) + sum(L d^3/12 uy^2)",
    substitution: `Jx = ${fmt(d)}(${fmt(props.Ix, 1)}) + torsional terms`,
    value: props.Jx,
    unit: "in^4",
    reference: REFS.shearStressFromMoment,
  });
  steps.push({
    id: "jy",
    title: "Jy (moment about Y)",
    formula: "Jy = d sum(L/3 (xa^2 + xa xb + xb^2)) + sum(L d^3/12 ux^2)",
    substitution: `Jy = ${fmt(d)}(${fmt(props.Iy, 1)}) + torsional terms`,
    value: props.Jy,
    unit: "in^4",
    reference: REFS.shearStressFromMoment,
  });

  if (Math.hypot(props.centroidX, props.centroidY) > 1e-6) {
    warnings.push({
      severity: "INFO",
      code: "CENTROID_SHIFT_MOMENT_NOT_INCLUDED",
      message:
        `Critical-section centroid is offset (${fmt(props.centroidX, 3)}, ${fmt(props.centroidY, 3)}) in from the column centroid. ` +
        `Additional moments Vu·e (${fmt((Vu * Math.abs(props.centroidY)) / 1000, 2)} kip-in about X, ` +
        `${fmt((Vu * Math.abs(props.centroidX)) / 1000, 2)} kip-in about Y) are not added; review if significant.`,
      reference: REFS.shearStressFromMoment,
    });
  }

  // 4. Demand (§8.4.2.2, §8.4.4.2).
  // Mux (about X) bends the slab spanning in Y: b1 = c2 + d. Muy (about Y): b1 = c1 + d.
  const gammaVx = momentTransferFractionShear(sizeY, sizeX);
  const gammaVy = momentTransferFractionShear(sizeX, sizeY);
  const directShear = Vu / (bo * d);

  let critical = { x: 0, y: 0, stress: Number.NEGATIVE_INFINITY, momentX: 0, momentY: 0 };
  for (const s of segments) {
    for (const p of [s.start, s.end]) {
      const momentX = (gammaVx * Math.abs(Mux) * Math.abs(p.y - props.centroidY)) / props.Jx;
      const momentY = (gammaVy * Math.abs(Muy) * Math.abs(p.x - props.centroidX)) / props.Jy;
      const stress = directShear + momentX + momentY;
      if (stress > critical.stress) critical = { x: p.x, y: p.y, stress, momentX, momentY };
    }
  }

  steps.push({
    id: "gamma-vx",
    title: "gamma_v for Mux",
    formula: "gamma_vx = 1 - 1/(1 + (2/3) sqrt(b1/b2)), b1 = c2 + d",
    substitution: `gamma_vx = 1 - 1/(1 + (2/3) sqrt(${fmt(sizeY)}/${fmt(sizeX)}))`,
    value: gammaVx,
    unit: "-",
    reference: REFS.momentTransferFraction,
  });
  steps.push({
    id: "gamma-vy",
    title: "gamma_v for Muy",
    formula: "gamma_vy = 1 - 1/(1 + (2/3) sqrt(b1/b2)), b1 = c1 + d",
    substitution: `gamma_vy = 1 - 1/(1 + (2/3) sqrt(${fmt(sizeX)}/${fmt(sizeY)}))`,
    value: gammaVy,
    unit: "-",
    reference: REFS.momentTransferFraction,
  });
  steps.push({
    id: "direct-shear",
    title: "Direct shear stress",
    formula: "vuv = Vu / (bo d)",
    substitution: `vuv = ${fmt(Vu)} / (${fmt(bo)} × ${fmt(d)})`,
    value: directShear,
    unit: "psi",
    reference: REFS.shearStressFromMoment,
  });
  steps.push({
    id: "moment-shear-x",
    title: "Shear stress from Mux at critical point",
    formula: "vux = gamma_vx |Mux| |y - yc| / Jx",
    substitution: `vux = ${fmt(gammaVx, 4)} × ${fmt(Math.abs(Mux))} × ${fmt(Math.abs(critical.y - props.centroidY))} / ${fmt(props.Jx, 0)}`,
    value: critical.momentX,
    unit: "psi",
    reference: REFS.shearStressFromMoment,
  });
  steps.push({
    id: "moment-shear-y",
    title: "Shear stress from Muy at critical point",
    formula: "vuy = gamma_vy |Muy| |x - xc| / Jy",
    substitution: `vuy = ${fmt(gammaVy, 4)} × ${fmt(Math.abs(Muy))} × ${fmt(Math.abs(critical.x - props.centroidX))} / ${fmt(props.Jy, 0)}`,
    value: critical.momentY,
    unit: "psi",
    reference: REFS.shearStressFromMoment,
  });
  steps.push({
    id: "vu-max",
    title: "Maximum factored shear stress",
    formula: "vu,max = vuv + vux + vuy",
    substitution: `vu,max = ${fmt(directShear)} + ${fmt(critical.momentX)} + ${fmt(critical.momentY)} at (${fmt(critical.x, 2)}, ${fmt(critical.y, 2)})`,
    value: critical.stress,
    unit: "psi",
    reference: REFS.shearStressFromMoment,
  });

  // 5. Capacity (Table 22.6.5.2).
  const lambdaS = applySizeEffect ? sizeEffectFactor(d) : 1;
  if (!applySizeEffect && sizeEffectFactor(d) < 1) {
    warnings.push({
      severity: "WARNING",
      code: "SIZE_EFFECT_OMITTED",
      message: `Size-effect factor lambda_s not applied (code value ${fmt(sizeEffectFactor(d), 3)} for d = ${fmt(d)} in). Result does not conform to ACI 318-19 Table 22.6.5.2 and is unconservative.`,
      reference: REFS.sizeEffect,
    });
  }
  const capacity = concreteCapacity({
    fc: input.concrete.fc,
    lambda: input.concrete.lambda,
    lambdaS,
    c1,
    c2,
    d,
    bo,
    columnLocation: input.columnLocation,
  });
  if (capacity.sqrtFcLimited) {
    warnings.push({
      severity: "INFO",
      code: "SQRT_FC_LIMITED",
      message: `sqrt(f'c) limited to ${TWS.sqrtFcLimitPsi} psi.`,
      reference: REFS.sqrtFcLimit,
    });
  }
  const base = `${fmt(lambdaS, 3)} × ${fmt(input.concrete.lambda)} × ${fmt(capacity.sqrtFc, 2)}`;
  steps.push({
    id: "lambda-s",
    title: "Size-effect factor",
    formula: applySizeEffect
      ? "lambda_s = sqrt(2/(1 + d/10)) <= 1.0"
      : "lambda_s = 1.0 (size effect omitted by option)",
    substitution: applySizeEffect ? `lambda_s = sqrt(2/(1 + ${fmt(d)}/10))` : "lambda_s = 1.0",
    value: lambdaS,
    unit: "-",
    reference: REFS.sizeEffect,
  });
  steps.push({
    id: "vc-a",
    title: "vc (a)",
    formula: "vc = 4 lambda_s lambda sqrt(f'c)",
    substitution: `vc = 4 × ${base}`,
    value: capacity.vcA,
    unit: "psi",
    reference: REFS.vcTable,
  });
  steps.push({
    id: "vc-b",
    title: "vc (b)",
    formula: "vc = (2 + 4/beta) lambda_s lambda sqrt(f'c)",
    substitution: `vc = (2 + 4/${fmt(capacity.betaC)}) × ${base}`,
    value: capacity.vcB,
    unit: "psi",
    reference: REFS.vcTable,
  });
  steps.push({
    id: "vc-c",
    title: "vc (c)",
    formula: "vc = (2 + alpha_s d/bo) lambda_s lambda sqrt(f'c)",
    substitution: `vc = (2 + ${capacity.alphaS} × ${fmt(d)}/${fmt(bo)}) × ${base}`,
    value: capacity.vcC,
    unit: "psi",
    reference: REFS.vcTable,
  });

  const phi = TWS.phiShear;
  const designStrength = phi * capacity.governingVc;
  steps.push({
    id: "design-strength",
    title: "Design shear stress strength",
    formula: "phi vc = phi × min(vc(a), vc(b), vc(c))",
    substitution: `phi vc = ${phi} × ${fmt(capacity.governingVc)}`,
    value: designStrength,
    unit: "psi",
    reference: REFS.phiShear,
  });

  // 6. DCR.
  const dcr = critical.stress / designStrength;
  steps.push({
    id: "dcr",
    title: "Demand / capacity ratio",
    formula: "DCR = vu,max / (phi vc)",
    substitution: `DCR = ${fmt(critical.stress)} / ${fmt(designStrength)}`,
    value: dcr,
    unit: "-",
    reference: REFS.twoWayShear,
  });

  const numericChecks = [bo, props.Jx, props.Jy, directShear, critical.stress, designStrength, dcr];
  if (!allFinite(numericChecks) || bo <= 0 || designStrength <= 0) {
    return unavailable(
      "Calculation produced a non-finite or non-positive intermediate value.",
      "Review geometry and material inputs.",
      warnings,
    );
  }

  return {
    ok: true,
    status: dcr <= DCR_LIMIT ? "PASS" : "FAIL",
    demand: {
      directShear,
      momentX: critical.momentX,
      momentY: critical.momentY,
      maximumShearStress: critical.stress,
      gammaVx,
      gammaVy,
      criticalPoint: { x: critical.x, y: critical.y, stress: critical.stress },
    },
    geometry: {
      sizeX,
      sizeY,
      grossPerimeter: perimeter.length,
      openingReductions,
      effectivePerimeter: bo,
      centroidX: props.centroidX,
      centroidY: props.centroidY,
      Ix: props.Ix,
      Iy: props.Iy,
      Jx: props.Jx,
      Jy: props.Jy,
      segments: segments.map((s) => ({ x1: s.start.x, y1: s.start.y, x2: s.end.x, y2: s.end.y })),
    },
    capacity: {
      lambda: input.concrete.lambda,
      lambdaS,
      sqrtFc: capacity.sqrtFc,
      betaC: capacity.betaC,
      alphaS: capacity.alphaS,
      vcA: capacity.vcA,
      vcB: capacity.vcB,
      vcC: capacity.vcC,
      governingVc: capacity.governingVc,
      governingEquation: capacity.governingEquation,
      phi,
      designStrength,
    },
    dcr,
    governingCheck: `Two-way shear, Table 22.6.5.2(${capacity.governingEquation})`,
    steps,
    codeReferences: Object.values(REFS),
    warnings,
    meta: {
      module: "punching-shear",
      designCode: `${ACI318_19.code}-${ACI318_19.edition.slice(2)}`,
      engineVersion: ENGINE_VERSION,
      method: PUNCHING_METHOD,
    },
  };
}
