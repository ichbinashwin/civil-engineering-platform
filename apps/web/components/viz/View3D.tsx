"use client";

import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import type { Opening, PunchingShearInput, PunchingShearOutcome } from "@civil/shared-types";
import { utilizationRgb } from "@/lib/format";
import { hexToNumber } from "@/lib/theme";
import type { Palette } from "@/lib/theme";
import { useTheme } from "../theme/ThemeProvider";

/**
 * 3D view of slab, column, openings, critical perimeter and the shear-stress "fence"
 * (height ∝ vu along bo; dashed loop = φvc). Presentation only — all values come from the engine.
 * Coordinates: X, Y in plan (in), Z up; slab occupies 0 ≤ z ≤ h.
 */
interface View3DProps {
  input: PunchingShearInput;
  outcome: PunchingShearOutcome;
  selectedOpening: string | null;
}

type Preset = "iso" | "top" | "front" | "side";

const SLAB_MARGIN_FACTOR = 1.35;
const FENCE_HEIGHT_FACTOR = 0.32;
const COLUMN_EXTENSION_FACTOR = 0.5;
const RIBBON_WIDTH_IN = 0.8;

function finite(...values: number[]): boolean {
  return values.every(Number.isFinite);
}

function openingValid(o: Opening): boolean {
  return o.type === "circle"
    ? finite(o.centerX, o.centerY, o.diameter) && o.diameter > 0
    : finite(o.centerX, o.centerY, o.width, o.height) && o.width > 0 && o.height > 0;
}

function detectWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function disposeGroup(group: THREE.Group) {
  group.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const mat = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
    else mat?.dispose();
  });
  group.clear();
}

function ribbon(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  z: number,
  color: string,
  width = RIBBON_WIDTH_IN,
) {
  const len = Math.hypot(x2 - x1, y2 - y1);
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(Math.max(len, 0.01), width, 0.25),
    new THREE.MeshBasicMaterial({ color }),
  );
  mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, z);
  mesh.rotation.z = Math.atan2(y2 - y1, x2 - x1);
  return mesh;
}

function line(points: THREE.Vector3[], color: string, dashed = false) {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = dashed
    ? new THREE.LineDashedMaterial({ color, dashSize: 2, gapSize: 1.5 })
    : new THREE.LineBasicMaterial({ color });
  const l = new THREE.Line(geometry, material);
  if (dashed) l.computeLineDistances();
  return l;
}

function sceneExtent(input: PunchingShearInput): number {
  let r = Math.max(
    finite(input.column.c1) ? input.column.c1 / 2 + (finite(input.d) ? input.d / 2 : 0) : 12,
    finite(input.column.c2) ? input.column.c2 / 2 + (finite(input.d) ? input.d / 2 : 0) : 12,
    12,
  );
  for (const o of input.openings) {
    if (!openingValid(o)) continue;
    const e = o.type === "circle" ? o.diameter / 2 : Math.max(o.width, o.height) / 2;
    r = Math.max(r, Math.abs(o.centerX) + e, Math.abs(o.centerY) + e);
  }
  return r;
}

function buildScene(
  group: THREE.Group,
  input: PunchingShearInput,
  outcome: PunchingShearOutcome,
  opts: {
    xray: boolean;
    fence: boolean;
    tangents: boolean;
    selectedOpening: string | null;
    palette: Palette;
  },
) {
  const h = finite(input.slabThickness) && input.slabThickness > 0 ? input.slabThickness : 12;
  const extent = sceneExtent(input);
  const half = extent * SLAB_MARGIN_FACTOR + 6;

  // Slab with openings as holes.
  const shape = new THREE.Shape();
  shape.moveTo(-half, -half);
  shape.lineTo(half, -half);
  shape.lineTo(half, half);
  shape.lineTo(-half, half);
  shape.lineTo(-half, -half);
  input.openings.forEach((o) => {
    if (!openingValid(o)) return;
    const hole = new THREE.Path();
    if (o.type === "circle") {
      hole.absarc(o.centerX, o.centerY, o.diameter / 2, 0, Math.PI * 2, true);
    } else {
      hole.moveTo(o.centerX - o.width / 2, o.centerY - o.height / 2);
      hole.lineTo(o.centerX - o.width / 2, o.centerY + o.height / 2);
      hole.lineTo(o.centerX + o.width / 2, o.centerY + o.height / 2);
      hole.lineTo(o.centerX + o.width / 2, o.centerY - o.height / 2);
      hole.lineTo(o.centerX - o.width / 2, o.centerY - o.height / 2);
    }
    shape.holes.push(hole);
  });
  const slab = new THREE.Mesh(
    new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false, curveSegments: 48 }),
    new THREE.MeshStandardMaterial({
      color: hexToNumber(opts.palette.slab),
      roughness: 0.9,
      transparent: opts.xray,
      opacity: opts.xray ? 0.35 : 1,
      depthWrite: !opts.xray,
      side: THREE.DoubleSide,
    }),
  );
  group.add(slab);
  const slabEdges = new THREE.LineSegments(
    new THREE.EdgesGeometry(slab.geometry, 30),
    new THREE.LineBasicMaterial({ color: hexToNumber(opts.palette.slabEdge) }),
  );
  group.add(slabEdges);

  // Opening outlines (selected highlighted).
  input.openings.forEach((o) => {
    if (!openingValid(o)) return;
    const selected = o.id !== undefined && o.id === opts.selectedOpening;
    const color = selected ? "#ff3b30" : opts.palette.openingStroke;
    // Red sleeve through the slab so small openings stay visible.
    const wallMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: selected ? 0.75 : 0.5,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const sleeve =
      o.type === "circle"
        ? new THREE.Mesh(
            new THREE.CylinderGeometry(o.diameter / 2, o.diameter / 2, h, 32, 1, true),
            wallMaterial,
          )
        : new THREE.Mesh(new THREE.BoxGeometry(o.width, o.height, h), wallMaterial);
    if (o.type === "circle") sleeve.rotation.x = Math.PI / 2;
    sleeve.position.set(o.centerX, o.centerY, h / 2);
    group.add(sleeve);
    for (const z of [0.05, h + 0.05]) {
      const pts: THREE.Vector3[] = [];
      if (o.type === "circle") {
        for (let k = 0; k <= 48; k++) {
          const a = (k / 48) * Math.PI * 2;
          pts.push(
            new THREE.Vector3(
              o.centerX + (Math.cos(a) * o.diameter) / 2,
              o.centerY + (Math.sin(a) * o.diameter) / 2,
              z,
            ),
          );
        }
      } else {
        const [x0, x1, y0, y1] = [
          o.centerX - o.width / 2,
          o.centerX + o.width / 2,
          o.centerY - o.height / 2,
          o.centerY + o.height / 2,
        ];
        pts.push(
          new THREE.Vector3(x0, y0, z),
          new THREE.Vector3(x1, y0, z),
          new THREE.Vector3(x1, y1, z),
          new THREE.Vector3(x0, y1, z),
          new THREE.Vector3(x0, y0, z),
        );
      }
      group.add(line(pts, color));
    }
  });

  // Column through the slab.
  const { c1, c2 } = input.column;
  if (finite(c1, c2) && c1 > 0 && c2 > 0) {
    const ext = extent * COLUMN_EXTENSION_FACTOR;
    const column = new THREE.Mesh(
      new THREE.BoxGeometry(c1, c2, h + 2 * ext),
      new THREE.MeshStandardMaterial({ color: hexToNumber(opts.palette.accent2), roughness: 0.6 }),
    );
    column.position.set(0, 0, h / 2);
    group.add(column);
    group.add(
      new THREE.LineSegments(
        new THREE.EdgesGeometry(column.geometry),
        new THREE.LineBasicMaterial({ color: hexToNumber(opts.palette.accent) }),
      ),
    );
    group.children[group.children.length - 1]?.position.set(0, 0, h / 2);
  }

  // Ground grid below the column.
  const grid = new THREE.GridHelper(
    half * 2,
    Math.max(4, Math.round((half * 2) / 12)),
    hexToNumber(opts.palette.gridMajor),
    hexToNumber(opts.palette.gridMinor),
  );
  grid.rotation.x = Math.PI / 2;
  grid.position.z = -extent * COLUMN_EXTENSION_FACTOR;
  group.add(grid);

  const axes = new THREE.AxesHelper(Math.max(12, extent * 0.35));
  axes.position.set(-half, -half, h + 0.1);
  group.add(axes);

  if (!outcome.ok) return { extent, h };
  const r = outcome;
  const zTop = h + 0.2;

  // Gross perimeter (thin), ineffective portions (red ribbons).
  const gx = r.geometry.sizeX / 2;
  const gy = r.geometry.sizeY / 2;
  group.add(
    line(
      [
        new THREE.Vector3(-gx, -gy, zTop),
        new THREE.Vector3(gx, -gy, zTop),
        new THREE.Vector3(gx, gy, zTop),
        new THREE.Vector3(-gx, gy, zTop),
        new THREE.Vector3(-gx, -gy, zTop),
      ],
      opts.palette.gross,
      true,
    ),
  );
  r.geometry.openingShadows.forEach((s) =>
    s.removedSegments.forEach((seg) =>
      group.add(
        ribbon(
          seg.x1,
          seg.y1,
          seg.x2,
          seg.y2,
          zTop + 0.1,
          opts.palette.critical,
          RIBBON_WIDTH_IN * 1.4,
        ),
      ),
    ),
  );

  // Effective perimeter ribbons.
  r.geometry.segments.forEach((seg) =>
    group.add(ribbon(seg.x1, seg.y1, seg.x2, seg.y2, zTop, opts.palette.perimeter)),
  );

  // Tangent lines from the column centroid.
  if (opts.tangents) {
    r.geometry.openingShadows.forEach((s) => {
      const o = input.openings[s.openingIndex];
      if (!o || !openingValid(o)) return;
      const reach =
        Math.hypot(o.centerX, o.centerY) +
        (o.type === "circle" ? o.diameter / 2 : Math.max(o.width, o.height) / 2);
      for (const t of [s.tangentStart, s.tangentEnd]) {
        const len = Math.hypot(t.x, t.y) || 1;
        group.add(
          line(
            [
              new THREE.Vector3(0, 0, zTop),
              new THREE.Vector3((t.x / len) * reach, (t.y / len) * reach, zTop),
            ],
            opts.palette.tangent,
            true,
          ),
        );
      }
    });
  }

  // Stress fence: height ∝ vu along bo, colored by vu / φvc.
  const capacity = r.capacity.designStrength;
  const scale = (extent * FENCE_HEIGHT_FACTOR) / capacity;
  if (opts.fence) {
    for (const poly of r.demand.stressProfile) {
      if (poly.length < 2) continue;
      const positions: number[] = [];
      const colors: number[] = [];
      const index: number[] = [];
      poly.forEach((p, k) => {
        const [cr, cg, cb] = utilizationRgb(p.stress / capacity);
        positions.push(p.x, p.y, zTop, p.x, p.y, zTop + p.stress * scale);
        colors.push(cr, cg, cb, cr, cg, cb);
        if (k > 0) {
          const a = 2 * (k - 1);
          index.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
        }
      });
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
      geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
      geometry.setIndex(index);
      group.add(
        new THREE.Mesh(
          geometry,
          new THREE.MeshBasicMaterial({
            vertexColors: true,
            side: THREE.DoubleSide,
            transparent: true,
            opacity: 0.82,
            depthWrite: false,
          }),
        ),
      );
      group.add(
        line(
          poly.map((p) => new THREE.Vector3(p.x, p.y, zTop + p.stress * scale)),
          opts.palette.fenceLine,
        ),
      );
    }

    // φvc reference loop.
    const zc = zTop + capacity * scale;
    group.add(
      line(
        [
          new THREE.Vector3(-gx, -gy, zc),
          new THREE.Vector3(gx, -gy, zc),
          new THREE.Vector3(gx, gy, zc),
          new THREE.Vector3(-gx, gy, zc),
          new THREE.Vector3(-gx, -gy, zc),
        ],
        opts.palette.critical,
        true,
      ),
    );
  }

  // Critical point and centroid markers.
  const crit = r.demand.criticalPoint;
  const critMarker = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.8, extent * 0.02), 20, 14),
    new THREE.MeshBasicMaterial({ color: hexToNumber(opts.palette.critical) }),
  );
  critMarker.position.set(crit.x, crit.y, opts.fence ? zTop + crit.stress * scale : zTop);
  group.add(critMarker);
  const centroid = new THREE.Mesh(
    new THREE.SphereGeometry(Math.max(0.6, extent * 0.015), 16, 12),
    new THREE.MeshBasicMaterial({ color: hexToNumber(opts.palette.centroid) }),
  );
  centroid.position.set(r.geometry.centroidX, r.geometry.centroidY, zTop + 0.5);
  group.add(centroid);

  return { extent, h };
}

export function View3D({ input, outcome, selectedOpening }: View3DProps) {
  const { palette } = useTheme();
  const hostRef = useRef<HTMLDivElement>(null);
  const ctx = useRef<{
    renderer: THREE.WebGLRenderer;
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    controls: OrbitControls;
    group: THREE.Group;
    frame: number;
  } | null>(null);
  const [webglAvailable] = useState(detectWebGL);
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  const [spin, setSpin] = useState(false);
  const [speed, setSpeed] = useState(1.5);
  const [xray, setXray] = useState(true);
  const [fence, setFence] = useState(true);
  const [tangents, setTangents] = useState(true);
  const [preset, setPreset] = useState<{ name: Preset; n: number }>({ name: "iso", n: 0 });
  const extentRef = useRef({ extent: 40, h: 18 });

  // Mount renderer once.
  useEffect(() => {
    const host = hostRef.current;
    if (!host || !webglAvailable) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      return;
    }
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    host.appendChild(renderer.domElement);
    renderer.domElement.setAttribute(
      "aria-label",
      "3D view of slab, column, openings and punching shear stress",
    );
    renderer.domElement.setAttribute("role", "img");

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.5, 5000);
    camera.up.set(0, 0, 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 1.1);
    sun.position.set(80, -120, 200);
    scene.add(sun);
    const group = new THREE.Group();
    scene.add(group);

    const resize = () => {
      const w = host.clientWidth || 600;
      const hgt = host.clientHeight || 400;
      renderer.setSize(w, hgt, false);
      camera.aspect = w / hgt;
      camera.updateProjectionMatrix();
    };
    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(host);

    const loop = () => {
      controls.update();
      renderer.render(scene, camera);
      if (ctx.current) ctx.current.frame = requestAnimationFrame(loop);
    };
    ctx.current = { renderer, scene, camera, controls, group, frame: 0 };
    ctx.current.frame = requestAnimationFrame(loop);

    return () => {
      ro.disconnect();
      if (ctx.current) cancelAnimationFrame(ctx.current.frame);
      disposeGroup(group);
      controls.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      ctx.current = null;
    };
  }, [webglAvailable]);

  // Rebuild model whenever inputs, results or display options change.
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    disposeGroup(c.group);
    extentRef.current = buildScene(c.group, input, outcome, {
      xray,
      fence,
      tangents,
      selectedOpening,
      palette,
    });
    c.renderer.setClearColor(hexToNumber(palette.canvas));
  }, [input, outcome, xray, fence, tangents, selectedOpening, palette]);

  // Camera presets (also initial fit).
  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    const { extent, h } = extentRef.current;
    const d = extent * 3.2;
    const target = new THREE.Vector3(0, 0, h / 2);
    const positions: Record<Preset, THREE.Vector3> = {
      iso: new THREE.Vector3(d * 0.75, -d, d * 0.7),
      top: new THREE.Vector3(0, -0.001, d * 1.25),
      front: new THREE.Vector3(0, -d * 1.2, h / 2 + d * 0.12),
      side: new THREE.Vector3(d * 1.2, 0, h / 2 + d * 0.12),
    };
    c.camera.position.copy(positions[preset.name]);
    c.controls.target.copy(target);
    c.controls.update();
  }, [preset]);

  useEffect(() => {
    const c = ctx.current;
    if (!c) return;
    c.controls.autoRotate = spin;
    c.controls.autoRotateSpeed = speed;
  }, [spin, speed]);

  return (
    <div>
      <div className="viz-toolbar">
        <div className="group-btns" role="toolbar" aria-label="3D view controls">
          <button
            type="button"
            className="btn small"
            aria-pressed={spin}
            onClick={() => setSpin((v) => !v)}
          >
            {spin ? "■ Stop spin" : "↻ Spin"}
          </button>
          <label className="small" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            Speed
            <input
              className="range"
              type="range"
              min={0.2}
              max={8}
              step={0.2}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              aria-label="Spin speed"
            />
          </label>
          {(["iso", "top", "front", "side"] as Preset[]).map((p) => (
            <button
              key={p}
              type="button"
              className="btn small"
              onClick={() => setPreset((s) => ({ name: p, n: s.n + 1 }))}
            >
              {p === "iso" ? "Reset (iso)" : p[0]?.toUpperCase() + p.slice(1)}
            </button>
          ))}
          <button
            type="button"
            className="btn small"
            aria-pressed={xray}
            onClick={() => setXray((v) => !v)}
          >
            X-ray slab
          </button>
          <button
            type="button"
            className="btn small"
            aria-pressed={fence}
            onClick={() => setFence((v) => !v)}
          >
            Stress fence
          </button>
          <button
            type="button"
            className="btn small"
            aria-pressed={tangents}
            onClick={() => setTangents((v) => !v)}
          >
            Tangents
          </button>
        </div>
        <span className="small">Drag to orbit · right-drag to pan · scroll to zoom</span>
      </div>
      <div className="canvas-wrap" ref={hostRef}>
        {!webglAvailable && (
          <div className="overlay" style={{ left: 12, top: 12 }}>
            WebGL is not available in this browser. Use the Plan 2D view.
          </div>
        )}
        <div className="overlay legend3d" aria-hidden="true">
          <div>
            <i className="ramp" /> vu / φvc
          </div>
          <div>Fence height ∝ vu · red dashed = φvc</div>
          <div>Blue = effective bo · red = ineffective</div>
          {prefersReducedMotion && <div>Reduced motion: spin off by default</div>}
        </div>
      </div>
    </div>
  );
}
