"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { PunchingShearInput, PunchingShearOutcome } from "@civil/shared-types";
import { PlanView } from "./PlanView";

const View3D = dynamic(() => import("./View3D").then((m) => m.View3D), {
  ssr: false,
  loading: () => <div className="canvas-wrap" aria-busy="true" />,
});

type Tab = "plan" | "3d";

interface VisualizationPanelProps {
  input: PunchingShearInput;
  outcome: PunchingShearOutcome;
  selectedOpening: string | null;
  onSelectOpening: (key: string | null) => void;
}

export function VisualizationPanel(props: VisualizationPanelProps) {
  const [tab, setTab] = useState<Tab>("plan");
  return (
    <section className="section" aria-labelledby="viz-h">
      <div className="section-title">
        <h3 id="viz-h" style={{ margin: 0, fontSize: 14 }}>
          Engineering Visualization
        </h3>
        <div className="tabs" role="tablist" aria-label="View">
          <button
            type="button"
            role="tab"
            aria-selected={tab === "plan"}
            onClick={() => setTab("plan")}
          >
            Plan 2D
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === "3d"}
            onClick={() => setTab("3d")}
          >
            3D
          </button>
        </div>
      </div>
      <div role="tabpanel">
        {tab === "plan" ? (
          <PlanView {...props} />
        ) : (
          <View3D
            input={props.input}
            outcome={props.outcome}
            selectedOpening={props.selectedOpening}
          />
        )}
      </div>
    </section>
  );
}
