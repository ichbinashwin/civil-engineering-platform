"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import type { PunchingVizOutcome } from "@civil/shared-types";
import type { VizInput } from "@/lib/viz-model";
import { Pane } from "../layout/Pane";
import { PlanView } from "./PlanView";

const View3D = dynamic(() => import("./View3D").then((m) => m.View3D), {
  ssr: false,
  loading: () => <div className="canvas-wrap" aria-busy="true" />,
});

type Tab = "plan" | "3d";

interface VisualizationPanelProps {
  input: VizInput;
  outcome: PunchingVizOutcome;
  selectedOpening: string | null;
  onSelectOpening: (key: string | null) => void;
}

export function VisualizationPanel(props: VisualizationPanelProps) {
  const [tab, setTab] = useState<Tab>("plan");
  return (
    <Pane
      id="viz"
      badge={
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
      }
    >
      <div role="tabpanel">
        {tab === "plan" ? (
          <PlanView key={props.input.lengthUnit} {...props} />
        ) : (
          <View3D
            key={props.input.lengthUnit}
            input={props.input}
            outcome={props.outcome}
            selectedOpening={props.selectedOpening}
          />
        )}
      </div>
    </Pane>
  );
}
