"use client";

import { useEffect } from "react";
import { PANES } from "@/lib/panes";
import { Icon } from "./PaneIcon";
import { usePaneLayout } from "./PaneLayout";

/**
 * Right-edge sidebar listing docked panes as icons. Click an icon to peek the pane as a flyout;
 * Esc or a click outside closes it. Hidden while nothing is docked.
 */
export function DockRail() {
  const { dockedIds, peek, setPeek, restoreAll } = usePaneLayout();

  useEffect(() => {
    if (!peek) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPeek(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peek, setPeek]);

  if (dockedIds.length === 0) return null;
  return (
    <>
      {peek && <div className="dock-backdrop" onClick={() => setPeek(null)} aria-hidden="true" />}
      <nav className="dock-rail no-print" aria-label="Docked panels">
        {dockedIds.map((id) => {
          const open = peek === id;
          return (
            <button
              key={id}
              type="button"
              className="dock-btn"
              aria-pressed={open}
              title={PANES[id].title}
              aria-label={`${PANES[id].title} (in sidebar) — ${open ? "close" : "open"}`}
              onClick={() => setPeek(open ? null : id)}
            >
              <Icon name={PANES[id].icon} size={20} />
            </button>
          );
        })}
        <span className="dock-sep" aria-hidden="true" />
        <button
          type="button"
          className="dock-btn"
          title="Restore all panels to the dashboard"
          aria-label="Restore all panels to the dashboard"
          onClick={restoreAll}
        >
          <Icon name="expand" size={18} />
        </button>
      </nav>
    </>
  );
}
