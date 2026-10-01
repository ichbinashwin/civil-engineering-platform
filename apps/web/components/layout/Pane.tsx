"use client";

import { useId } from "react";
import type { ReactNode } from "react";
import { PANES } from "@/lib/panes";
import type { PaneId } from "@/lib/panes";
import { Icon } from "./PaneIcon";
import { usePaneLayout } from "./PaneLayout";

interface PaneProps {
  id: PaneId;
  /** Status badge(s) or tabs shown in the header next to the title. */
  badge?: ReactNode;
  /** Remove the default body padding (for bodies that manage their own). */
  flush?: boolean;
  children: ReactNode;
}

/**
 * A dashboard container: collapses in place (chevron / title), or docks into the right-edge icon rail
 * (dock button). A docked pane stays mounted (state is kept) and is shown as a flyout when its rail
 * icon is clicked. Children are never unmounted by collapsing or docking.
 */
export function Pane({ id, badge, flush = false, children }: PaneProps) {
  const { isCollapsed, isDocked, peek, toggleCollapsed, dock, restore, setPeek } = usePaneLayout();
  const def = PANES[id];
  const headId = useId();
  const bodyId = useId();
  const docked = isDocked(id);
  const peeking = docked && peek === id;
  const open = peeking || !isCollapsed(id);

  return (
    <section
      className={`panel pane${docked ? " docked" : ""}${peeking ? ` peek side-${def.side}` : ""}`}
      aria-labelledby={headId}
      data-pane={id}
      style={peeking ? { width: `min(${def.flyoutWidth}px, calc(100vw - 84px))` } : undefined}
      data-side={def.side}
    >
      <header className="pane-head">
        <h2 id={headId} className="pane-title">
          {docked ? (
            <span className="pane-title-static">
              <Icon name={def.icon} />
              {def.title}
            </span>
          ) : (
            <button
              type="button"
              className="pane-toggle"
              aria-expanded={open}
              aria-controls={bodyId}
              title={open ? `Collapse ${def.title}` : `Expand ${def.title}`}
              onClick={() => toggleCollapsed(id)}
            >
              <span className={`chev${open ? " open" : ""}`}>
                <Icon name="chevron" size={16} />
              </span>
              <Icon name={def.icon} />
              {def.title}
            </button>
          )}
        </h2>
        {badge && <span className="pane-badge">{badge}</span>}
        <span className="pane-actions no-print">
          {docked ? (
            <>
              <button
                type="button"
                className="icon-btn"
                title={`Restore ${def.title} to the dashboard`}
                aria-label={`Restore ${def.title} to the dashboard`}
                onClick={() => restore(id)}
              >
                <Icon name={def.side === "left" ? "restoreLeft" : "restore"} size={16} />
              </button>
              <button
                type="button"
                className="icon-btn"
                title="Close"
                aria-label={`Close ${def.title}`}
                onClick={() => setPeek(null)}
              >
                <Icon name="close" size={16} />
              </button>
            </>
          ) : (
            <button
              type="button"
              className="icon-btn"
              title={`Move ${def.title} to the ${def.side} sidebar`}
              aria-label={`Move ${def.title} to the ${def.side} sidebar`}
              onClick={() => dock(id)}
            >
              <Icon name={def.side === "left" ? "dockLeft" : "dock"} size={16} />
            </button>
          )}
        </span>
      </header>
      <div id={bodyId} className={flush ? "pane-body flush" : "pane-body"} hidden={!open}>
        {children}
      </div>
    </section>
  );
}
