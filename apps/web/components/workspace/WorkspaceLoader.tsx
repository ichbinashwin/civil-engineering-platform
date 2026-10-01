"use client";

import dynamic from "next/dynamic";

/** Client-only: the workspace restores local state, applies the theme and uses WebGL. */
export const WorkspaceLoader = dynamic(
  () => import("./ThemedWorkspace").then((m) => m.ThemedWorkspace),
  {
    ssr: false,
    loading: () => (
      <p style={{ padding: 24 }} className="small">
        Loading engineering workspace…
      </p>
    ),
  },
);
