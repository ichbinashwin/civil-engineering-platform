"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Opening, PunchingShearInput, PunchingShearOutcome } from "@civil/shared-types";
import { convertForce, convertMoment } from "@civil/engineering-core";
import { formatNumber, utilizationColor } from "@/lib/format";

/**
 * Interactive 2D plan of the punching-shear critical section. Pure presentation of engine output:
 * column, gross/effective perimeter, ineffective portions, opening tangent lines, centroid,
 * critical point and stress utilization along bo. Supports zoom, pan, fit, grid and inspection.
 */
interface PlanViewProps {
  input: PunchingShearInput;
  outcome: PunchingShearOutcome;
  selectedOpening: string | null;
  onSelectOpening: (key: string | null) => void;
}

type Selection = { kind: "opening"; key: string } | { kind: "perimeter" } | null;

interface View {
  k: number;
  cx: number;
  cy: number;
}

const GRID_STEPS_IN = [1, 2, 3, 6, 12, 24, 48, 96];
const MIN_GRID_PX = 28;
const FIT_PADDING = 1.25;
const ZOOM_STEP = 1.25;
const DRAG_THRESHOLD_PX = 3;

const COLORS = {
  column: "#dceaf5",
  columnStroke: "#1f4e78",
  gross: "#9aa7b3",
  removed: "#b42318",
  opening: "#fff0ee",
  openingStroke: "#b42318",
  tangent: "#d9776f",
  axis: "#aab4be",
  grid: "#edf0f3",
  centroid: "#1f4e78",
};

function finite(...values: number[]): boolean {
  return values.every(Number.isFinite);
}

function openingExtent(o: Opening): { hx: number; hy: number } {
  return o.type === "circle"
    ? { hx: o.diameter / 2, hy: o.diameter / 2 }
    : { hx: o.width / 2, hy: o.height / 2 };
}

function sceneBounds(input: PunchingShearInput, outcome: PunchingShearOutcome) {
  let maxX = 12;
  let maxY = 12;
  const grow = (x: number, y: number) => {
    if (finite(x, y)) {
      maxX = Math.max(maxX, Math.abs(x));
      maxY = Math.max(maxY, Math.abs(y));
    }
  };
  if (outcome.ok) grow(outcome.geometry.sizeX / 2, outcome.geometry.sizeY / 2);
  else grow(input.column.c1 / 2 + input.d / 2, input.column.c2 / 2 + input.d / 2);
  for (const o of input.openings) {
    const e = openingExtent(o);
    grow(Math.abs(o.centerX) + e.hx, Math.abs(o.centerY) + e.hy);
  }
  return { maxX, maxY };
}

export function PlanView({ input, outcome, selectedOpening, onSelectOpening }: PlanViewProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 500 });
  const [userView, setUserView] = useState<View | null>(null);
  const [showGrid, setShowGrid] = useState(true);
  const [showTangents, setShowTangents] = useState(true);
  const [showStress, setShowStress] = useState(true);
  const [hover, setHover] = useState<{ x: number; y: number } | null>(null);
  const [perimeterSelected, setPerimeterSelected] = useState(false);
  const [panning, setPanning] = useState(false);
  const drag = useRef<{ px: number; py: number; view: View; moved: boolean } | null>(null);

  const bounds = useMemo(() => sceneBounds(input, outcome), [input, outcome]);
  const fitView = useMemo<View>(
    () => ({
      k: Math.min(
        size.w / (2 * bounds.maxX * FIT_PADDING),
        size.h / (2 * bounds.maxY * FIT_PADDING),
      ),
      cx: 0,
      cy: 0,
    }),
    [bounds, size],
  );
  const view = userView ?? fitView;

  const selection: Selection = selectedOpening
    ? { kind: "opening", key: selectedOpening }
    : perimeterSelected
      ? { kind: "perimeter" }
      : null;

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          w: Math.max(entry.contentRect.width, 100),
          h: Math.max(entry.contentRect.height, 100),
        });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toWorld = useCallback(
    (clientX: number, clientY: number, v: View) => {
      const rect = svgRef.current?.getBoundingClientRect();
      if (!rect) return { x: 0, y: 0 };
      return {
        x: v.cx + (clientX - rect.left - size.w / 2) / v.k,
        y: v.cy - (clientY - rect.top - size.h / 2) / v.k,
      };
    },
    [size],
  );

  // Wheel zoom about the cursor (non-passive listener so the page does not scroll).
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP;
      setUserView((prev) => {
        const v = prev ?? fitView;
        const p = toWorld(e.clientX, e.clientY, v);
        const k = v.k * factor;
        return { k, cx: p.x - (p.x - v.cx) * (v.k / k), cy: p.y - (p.y - v.cy) * (v.k / k) };
      });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [fitView, toWorld]);

  const sx = (x: number) => size.w / 2 + (x - view.cx) * view.k;
  const sy = (y: number) => size.h / 2 - (y - view.cy) * view.k;
  const zoom = (factor: number) => setUserView({ ...view, k: view.k * factor });

  const result = outcome.ok ? outcome : null;
  const designStrength = result?.capacity.designStrength ?? Number.NaN;
  const openingKeys = input.openings.map((o, i) => o.id ?? `index-${i}`);

  // Grid
  const gridStep = GRID_STEPS_IN.find((s) => s * view.k >= MIN_GRID_PX) ?? 96;
  const gridLines: React.ReactNode[] = [];
  if (showGrid) {
    const x0 = view.cx - size.w / 2 / view.k;
    const x1 = view.cx + size.w / 2 / view.k;
    const y0 = view.cy - size.h / 2 / view.k;
    const y1 = view.cy + size.h / 2 / view.k;
    for (let x = Math.ceil(x0 / gridStep) * gridStep; x <= x1; x += gridStep) {
      gridLines.push(
        <line key={`gx${x}`} x1={sx(x)} x2={sx(x)} y1={0} y2={size.h} stroke={COLORS.grid} />,
      );
    }
    for (let y = Math.ceil(y0 / gridStep) * gridStep; y <= y1; y += gridStep) {
      gridLines.push(
        <line key={`gy${y}`} y1={sy(y)} y2={sy(y)} x1={0} x2={size.w} stroke={COLORS.grid} />,
      );
    }
  }

  const c1 = input.column.c1;
  const c2 = input.column.c2;
  const columnValid = finite(c1, c2) && c1 > 0 && c2 > 0;

  const selectedIndex = selection?.kind === "opening" ? openingKeys.indexOf(selection.key) : -1;
  const selectedOpeningData = selectedIndex >= 0 ? input.openings[selectedIndex] : undefined;
  const selectedReduction = result?.geometry.openingReductions.find(
    (r) => r.openingIndex === selectedIndex,
  );

  return (
    <div>
      <div className="viz-toolbar">
        <div className="group-btns" role="toolbar" aria-label="Plan view controls">
          <button
            type="button"
            className="btn small"
            onClick={() => zoom(ZOOM_STEP)}
            aria-label="Zoom in"
          >
            +
          </button>
          <button
            type="button"
            className="btn small"
            onClick={() => zoom(1 / ZOOM_STEP)}
            aria-label="Zoom out"
          >
            −
          </button>
          <button type="button" className="btn small" onClick={() => setUserView(null)}>
            Fit / reset
          </button>
          <button
            type="button"
            className="btn small"
            aria-pressed={showGrid}
            onClick={() => setShowGrid((v) => !v)}
          >
            Grid
          </button>
          <button
            type="button"
            className="btn small"
            aria-pressed={showTangents}
            onClick={() => setShowTangents((v) => !v)}
          >
            Tangents
          </button>
          <button
            type="button"
            className="btn small"
            aria-pressed={showStress}
            onClick={() => setShowStress((v) => !v)}
          >
            Stress colors
          </button>
        </div>
        <span className="small">Scroll to zoom · drag to pan · click items to inspect</span>
      </div>

      <div className="canvas-wrap">
        <svg
          ref={svgRef}
          className={panning ? "panning" : undefined}
          role="img"
          aria-label="Plan view of column, critical punching perimeter and slab openings"
          onPointerDown={(e) => {
            drag.current = { px: e.clientX, py: e.clientY, view, moved: false };
          }}
          onPointerMove={(e) => {
            setHover(toWorld(e.clientX, e.clientY, view));
            const d = drag.current;
            if (!d) return;
            const dx = e.clientX - d.px;
            const dy = e.clientY - d.py;
            if (!d.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
            if (!d.moved) setPanning(true);
            d.moved = true;
            setUserView({
              k: d.view.k,
              cx: d.view.cx - dx / d.view.k,
              cy: d.view.cy + dy / d.view.k,
            });
          }}
          onPointerUp={(e) => {
            const d = drag.current;
            drag.current = null;
            setPanning(false);
            if (d && !d.moved && e.target === e.currentTarget) {
              onSelectOpening(null);
              setPerimeterSelected(false);
            }
          }}
          onPointerLeave={() => {
            drag.current = null;
            setPanning(false);
            setHover(null);
          }}
        >
          <rect x={0} y={0} width={size.w} height={size.h} fill="#fbfcfd" pointerEvents="none" />
          {gridLines}
          {/* Axes */}
          <line
            x1={0}
            x2={size.w}
            y1={sy(0)}
            y2={sy(0)}
            stroke={COLORS.axis}
            strokeDasharray="6 4"
          />
          <line
            y1={0}
            y2={size.h}
            x1={sx(0)}
            x2={sx(0)}
            stroke={COLORS.axis}
            strokeDasharray="6 4"
          />
          <text x={size.w - 14} y={sy(0) - 6} fontSize={12} fill="#66727f" textAnchor="end">
            X
          </text>
          <text x={sx(0) + 6} y={14} fontSize={12} fill="#66727f">
            Y
          </text>

          {/* Tangent lines from column centroid (§22.6.4.3) */}
          {showTangents &&
            result?.geometry.openingShadows.map((s) => {
              const o = input.openings[s.openingIndex];
              if (!o) return null;
              const e = openingExtent(o);
              const reach = Math.hypot(o.centerX, o.centerY) + Math.max(e.hx, e.hy);
              return [s.tangentStart, s.tangentEnd].map((t, j) => {
                const len = Math.hypot(t.x, t.y) || 1;
                return (
                  <line
                    key={`t${s.openingIndex}-${j}`}
                    x1={sx(0)}
                    y1={sy(0)}
                    x2={sx((t.x / len) * reach)}
                    y2={sy((t.y / len) * reach)}
                    stroke={COLORS.tangent}
                    strokeDasharray="4 3"
                    strokeWidth={1}
                  />
                );
              });
            })}

          {/* Gross critical perimeter */}
          {result && (
            <rect
              x={sx(-result.geometry.sizeX / 2)}
              y={sy(result.geometry.sizeY / 2)}
              width={result.geometry.sizeX * view.k}
              height={result.geometry.sizeY * view.k}
              fill="none"
              stroke={COLORS.gross}
              strokeDasharray="3 3"
            />
          )}

          {/* Column */}
          {columnValid && (
            <rect
              x={sx(-c1 / 2)}
              y={sy(c2 / 2)}
              width={c1 * view.k}
              height={c2 * view.k}
              fill={COLORS.column}
              stroke={COLORS.columnStroke}
              strokeWidth={2}
            />
          )}
          {columnValid && (
            <text
              x={sx(0)}
              y={sy(0) - 4}
              fontSize={11}
              fill={COLORS.columnStroke}
              textAnchor="middle"
              fontWeight={700}
            >
              COLUMN
            </text>
          )}
          {columnValid && (
            <text
              x={sx(0)}
              y={sy(0) + 10}
              fontSize={10}
              fill={COLORS.columnStroke}
              textAnchor="middle"
            >
              {formatNumber(c1, 0)} × {formatNumber(c2, 0)} in
            </text>
          )}

          {/* Effective perimeter colored by stress utilization (clickable) */}
          {result && (
            <g
              role="button"
              tabIndex={0}
              aria-label="Critical perimeter — show section properties"
              style={{ cursor: "pointer" }}
              onPointerUp={(e) => {
                e.stopPropagation();
                drag.current = null;
                onSelectOpening(null);
                setPerimeterSelected(true);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  onSelectOpening(null);
                  setPerimeterSelected(true);
                }
              }}
            >
              {result.demand.stressProfile.flatMap((poly, i) =>
                poly.slice(1).map((p, j) => {
                  const a = poly[j];
                  if (!a) return null;
                  const ratio = (a.stress + p.stress) / 2 / designStrength;
                  return (
                    <line
                      key={`s${i}-${j}`}
                      x1={sx(a.x)}
                      y1={sy(a.y)}
                      x2={sx(p.x)}
                      y2={sy(p.y)}
                      stroke={showStress ? utilizationColor(ratio) : "#2f6f9f"}
                      strokeWidth={perimeterSelected ? 6 : 4}
                      strokeLinecap="round"
                    />
                  );
                }),
              )}
            </g>
          )}

          {/* Ineffective portions */}
          {result?.geometry.openingShadows.flatMap((s) =>
            s.removedSegments.map((seg, j) => (
              <line
                key={`r${s.openingIndex}-${j}`}
                x1={sx(seg.x1)}
                y1={sy(seg.y1)}
                x2={sx(seg.x2)}
                y2={sy(seg.y2)}
                stroke={COLORS.removed}
                strokeWidth={6}
                strokeLinecap="butt"
                opacity={0.9}
              />
            )),
          )}

          {/* Openings */}
          {input.openings.map((o, i) => {
            const e = openingExtent(o);
            if (!finite(o.centerX, o.centerY, e.hx, e.hy) || e.hx <= 0 || e.hy <= 0) return null;
            const key = openingKeys[i] ?? String(i);
            const selected = selection?.kind === "opening" && selection.key === key;
            const common = {
              fill: COLORS.opening,
              stroke: COLORS.openingStroke,
              strokeWidth: selected ? 3 : 2,
            };
            const select = () => {
              setPerimeterSelected(false);
              onSelectOpening(key);
            };
            return (
              <g
                key={key}
                role="button"
                tabIndex={0}
                aria-label={`Opening ${i + 1} — show properties`}
                style={{ cursor: "pointer" }}
                onPointerUp={(ev) => {
                  ev.stopPropagation();
                  drag.current = null;
                  select();
                }}
                onKeyDown={(ev) => {
                  if (ev.key === "Enter" || ev.key === " ") select();
                }}
              >
                {o.type === "circle" ? (
                  <circle
                    cx={sx(o.centerX)}
                    cy={sy(o.centerY)}
                    r={Math.max(e.hx * view.k, 3)}
                    {...common}
                  />
                ) : (
                  <rect
                    x={sx(o.centerX - e.hx)}
                    y={sy(o.centerY + e.hy)}
                    width={Math.max(2 * e.hx * view.k, 3)}
                    height={Math.max(2 * e.hy * view.k, 3)}
                    {...common}
                  />
                )}
                <text
                  x={sx(o.centerX)}
                  y={sy(o.centerY + e.hy) - 5}
                  fontSize={11}
                  fontWeight={700}
                  fill={COLORS.openingStroke}
                  textAnchor="middle"
                >
                  O{i + 1}
                </text>
              </g>
            );
          })}

          {/* Dimensions of the critical section */}
          {result && (
            <g fontSize={10} fill="#35404a">
              <line
                x1={sx(-result.geometry.sizeX / 2)}
                x2={sx(result.geometry.sizeX / 2)}
                y1={sy(-result.geometry.sizeY / 2) + 18}
                y2={sy(-result.geometry.sizeY / 2) + 18}
                stroke="#66727f"
                markerStart="url(#dim)"
                markerEnd="url(#dim)"
              />
              <text x={sx(0)} y={sy(-result.geometry.sizeY / 2) + 30} textAnchor="middle">
                c1 + d = {formatNumber(result.geometry.sizeX, 2)} in
              </text>
              <line
                y1={sy(result.geometry.sizeY / 2)}
                y2={sy(-result.geometry.sizeY / 2)}
                x1={sx(result.geometry.sizeX / 2) + 18}
                x2={sx(result.geometry.sizeX / 2) + 18}
                stroke="#66727f"
                markerStart="url(#dim)"
                markerEnd="url(#dim)"
              />
              <text
                x={sx(result.geometry.sizeX / 2) + 30}
                y={sy(0)}
                textAnchor="middle"
                transform={`rotate(-90 ${sx(result.geometry.sizeX / 2) + 30} ${sy(0)})`}
              >
                c2 + d = {formatNumber(result.geometry.sizeY, 2)} in
              </text>
            </g>
          )}

          {/* Centroid of effective section */}
          {result && (
            <g stroke={COLORS.centroid} strokeWidth={1.5}>
              <line
                x1={sx(result.geometry.centroidX) - 7}
                x2={sx(result.geometry.centroidX) + 7}
                y1={sy(result.geometry.centroidY)}
                y2={sy(result.geometry.centroidY)}
              />
              <line
                y1={sy(result.geometry.centroidY) - 7}
                y2={sy(result.geometry.centroidY) + 7}
                x1={sx(result.geometry.centroidX)}
                x2={sx(result.geometry.centroidX)}
              />
              <circle
                cx={sx(result.geometry.centroidX)}
                cy={sy(result.geometry.centroidY)}
                r={4}
                fill="none"
              />
            </g>
          )}

          {/* Critical point */}
          {result && (
            <g>
              <circle
                cx={sx(result.demand.criticalPoint.x)}
                cy={sy(result.demand.criticalPoint.y)}
                r={7}
                fill="none"
                stroke="#b42318"
                strokeWidth={2}
              />
              <circle
                cx={sx(result.demand.criticalPoint.x)}
                cy={sy(result.demand.criticalPoint.y)}
                r={2.5}
                fill="#b42318"
              />
              <text
                x={sx(result.demand.criticalPoint.x) + 10}
                y={sy(result.demand.criticalPoint.y) - 10}
                fontSize={11}
                fill="#b42318"
                fontWeight={700}
              >
                vu,max = {formatNumber(result.demand.maximumShearStress, 1)} psi
              </text>
            </g>
          )}

          {/* Moment vectors (double-headed arrows, right-hand rule) */}
          <g transform={`translate(${size.w - 112}, ${size.h - 56})`} fontSize={10} fill="#35404a">
            <rect
              x={-8}
              y={-30}
              width={116}
              height={78}
              fill="rgba(255,255,255,0.9)"
              stroke="#dbe1e6"
              rx={6}
            />
            <line
              x1={0}
              y1={0}
              x2={44}
              y2={0}
              stroke="#1f4e78"
              strokeWidth={1.5}
              markerEnd="url(#dbl)"
            />
            <text x={50} y={4}>
              Mux {formatNumber(convertMoment(input.Mux, "lb-in", "kip-ft"), 1)}
            </text>
            <line
              x1={0}
              y1={0}
              x2={0}
              y2={-24}
              stroke="#1f4e78"
              strokeWidth={1.5}
              markerEnd="url(#dbl)"
            />
            <text x={6} y={-18}>
              Muy {formatNumber(convertMoment(input.Muy, "lb-in", "kip-ft"), 1)}
            </text>
            <text x={0} y={22} fill="#66727f">
              kip-ft · vectors
            </text>
            <text x={0} y={36} fill="#66727f">
              Vu {formatNumber(convertForce(input.Vu, "lb", "kip"), 1)} kip ⊗
            </text>
          </g>

          <defs>
            <marker id="dim" markerWidth="8" markerHeight="8" refX="4" refY="4" orient="auto">
              <path d="M4,0 L4,8" stroke="#66727f" />
            </marker>
            <marker
              id="dbl"
              markerWidth="12"
              markerHeight="8"
              refX="11"
              refY="4"
              orient="auto"
              markerUnits="userSpaceOnUse"
            >
              <path
                d="M0,0 L6,4 L0,8 M5,0 L11,4 L5,8"
                fill="none"
                stroke="#1f4e78"
                strokeWidth="1.3"
              />
            </marker>
          </defs>
        </svg>

        {hover && (
          <div className="overlay coords" aria-hidden="true">
            x {formatNumber(hover.x, 2)} in · y {formatNumber(hover.y, 2)} in · grid {gridStep} in
          </div>
        )}

        {selection?.kind === "perimeter" && result && (
          <div
            className="overlay inspector"
            role="dialog"
            aria-label="Critical perimeter properties"
          >
            <strong>Critical perimeter</strong>
            <dl className="kv">
              <dt>bo (effective)</dt>
              <dd>{formatNumber(result.geometry.effectivePerimeter, 3)} in</dd>
              <dt>centroid</dt>
              <dd>
                ({formatNumber(result.geometry.centroidX, 3)},{" "}
                {formatNumber(result.geometry.centroidY, 3)})
              </dd>
              <dt>Ix</dt>
              <dd>{formatNumber(result.geometry.Ix, 0)} in³</dd>
              <dt>Iy</dt>
              <dd>{formatNumber(result.geometry.Iy, 0)} in³</dd>
              <dt>Jx</dt>
              <dd>{formatNumber(result.geometry.Jx, 0)} in⁴</dd>
              <dt>Jy</dt>
              <dd>{formatNumber(result.geometry.Jy, 0)} in⁴</dd>
            </dl>
            <button
              type="button"
              className="btn small"
              style={{ marginTop: 6 }}
              onClick={() => setPerimeterSelected(false)}
            >
              Close
            </button>
          </div>
        )}

        {selectedOpeningData && (
          <div
            className="overlay inspector"
            role="dialog"
            aria-label={`Opening ${selectedIndex + 1} properties`}
          >
            <strong>Opening {selectedIndex + 1}</strong>
            <dl className="kv">
              <dt>Shape</dt>
              <dd>{selectedOpeningData.type}</dd>
              <dt>Center</dt>
              <dd>
                ({formatNumber(selectedOpeningData.centerX, 2)},{" "}
                {formatNumber(selectedOpeningData.centerY, 2)}) in
              </dd>
              {selectedOpeningData.type === "circle" ? (
                <>
                  <dt>Diameter</dt>
                  <dd>{formatNumber(selectedOpeningData.diameter, 2)} in</dd>
                </>
              ) : (
                <>
                  <dt>Width × height</dt>
                  <dd>
                    {formatNumber(selectedOpeningData.width, 2)} ×{" "}
                    {formatNumber(selectedOpeningData.height, 2)} in
                  </dd>
                </>
              )}
              <dt>Distance to centroid</dt>
              <dd>
                {formatNumber(
                  Math.hypot(selectedOpeningData.centerX, selectedOpeningData.centerY),
                  2,
                )}{" "}
                in
              </dd>
              <dt>bo removed</dt>
              <dd>
                {selectedReduction ? `${formatNumber(selectedReduction.reduction, 3)} in` : "—"}
              </dd>
            </dl>
            <button
              type="button"
              className="btn small"
              style={{ marginTop: 6 }}
              onClick={() => onSelectOpening(null)}
            >
              Close
            </button>
          </div>
        )}
      </div>

      <div className="legend">
        <span>
          <i className="swatch" style={{ background: COLORS.columnStroke }} />
          Column
        </span>
        <span>
          <i className="ramp" style={{ width: 60, height: 4 }} /> bo (vu / φvc)
        </span>
        <span>
          <i className="swatch" style={{ background: COLORS.removed }} />
          Ineffective bo
        </span>
        <span>
          <i className="swatch" style={{ background: COLORS.gross, height: 2 }} />
          Gross perimeter
        </span>
        <span>
          <i className="swatch" style={{ background: COLORS.tangent, height: 2 }} />
          Tangent lines
        </span>
        <span>⊕ Centroid</span>
        <span style={{ color: "#b42318" }}>◎ Critical point</span>
      </div>
    </div>
  );
}
