"use client";

import { useEffect } from "react";
import { PANES } from "@/lib/panes";
import type { DockSide } from "@/lib/panes";
import { Icon } from "./PaneIcon";
import { usePaneLayout } from "./PaneLayout";

/**
 * Edge sidebar listing docked panes of one side as icons. Click an icon to peek the pane as a flyout;
 * Esc or a click outside closes it. Hidden while nothing is docked on this side.
 */
export function DockRail({ side }: { side: DockSide }) {
  const { dockedOn, peek, setPeek, restoreSide } = usePaneLayout();
  const ids = dockedOn(side);
  const peekingHere = peek !== null && PANES[peek].side === side && ids.includes(peek);

  useEffect(() => {
    if (!peekingHere) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setPeek(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [peekingHere, setPeek]);

  if (ids.length === 0) return null;
  return (
    <>
      {peekingHere && (
        <div className="dock-backdrop" onClick={() => setPeek(null)} aria-hidden="true" />
      )}
      <nav className={`dock-rail ${side} no-print`} aria-label={`Docked panels, ${side} sidebar`}>
        {ids.map((id) => {
          const open = peek === id;
          return (
            <button
              key={id}
              type="button"
              className="dock-btn"
              aria-pressed={open}
              title={PANES[id].title}
              aria-label={`${PANES[id].title} (in ${side} sidebar) — ${open ? "close" : "open"}`}
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
          title={`Restore all ${side} sidebar panels to the dashboard`}
          aria-label={`Restore all ${side} sidebar panels to the dashboard`}
          onClick={() => restoreSide(side)}
        >
          <Icon name="expand" size={18} />
        </button>
      </nav>
    </>
  );
}
