"use client";

import dynamic from "next/dynamic";

/** Client-only: the workspace restores local state and uses WebGL. */
export const WorkspaceLoader = dynamic(() => import("./Workspace").then((m) => m.Workspace), {
  ssr: false,
  loading: () => (
    <p style={{ padding: 24 }} className="small">
      Loading engineering workspace…
    </p>
  ),
});
