"use client";

import { usePaneLayout } from "./PaneLayout";

export function LayoutBar() {
  const { collapseAll, expandAll, restoreAll, dockedIds } = usePaneLayout();
  return (
    <div className="layout-bar no-print" role="toolbar" aria-label="Panel layout">
      <span className="small">Panels</span>
      <button type="button" className="btn small" onClick={expandAll}>
        Expand all
      </button>
      <button type="button" className="btn small" onClick={collapseAll}>
        Collapse all
      </button>
      <button
        type="button"
        className="btn small"
        onClick={restoreAll}
        disabled={dockedIds.length === 0}
      >
        Restore sidebar panels{dockedIds.length > 0 ? ` (${dockedIds.length})` : ""}
      </button>
    </div>
  );
}
