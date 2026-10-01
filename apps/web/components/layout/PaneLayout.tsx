"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PANES, PANE_IDS, PANE_STORAGE_KEY, isPaneId } from "@/lib/panes";
import type { DockSide, PaneId } from "@/lib/panes";

interface LayoutState {
  collapsed: PaneId[];
  docked: PaneId[];
}

interface PaneLayoutValue {
  isCollapsed: (id: PaneId) => boolean;
  isDocked: (id: PaneId) => boolean;
  peek: PaneId | null;
  dockedIds: PaneId[];
  /** Docked panes of one sidebar, in registry order. */
  dockedOn: (side: DockSide) => PaneId[];
  restoreSide: (side: DockSide) => void;
  toggleCollapsed: (id: PaneId) => void;
  dock: (id: PaneId) => void;
  restore: (id: PaneId) => void;
  restoreAll: () => void;
  collapseAll: () => void;
  expandAll: () => void;
  setPeek: (id: PaneId | null) => void;
}

const DEFAULT_STATE: LayoutState = {
  collapsed: PANE_IDS.filter((id) => PANES[id].defaultCollapsed),
  docked: [],
};

function load(): LayoutState {
  try {
    const raw = window.localStorage.getItem(PANE_STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<Record<keyof LayoutState, unknown>>;
    const clean = (v: unknown): PaneId[] => (Array.isArray(v) ? v.filter(isPaneId) : []);
    return { collapsed: clean(parsed.collapsed), docked: clean(parsed.docked) };
  } catch {
    return DEFAULT_STATE;
  }
}

const PaneLayoutContext = createContext<PaneLayoutValue | null>(null);

/** Layout state for collapsible / dockable panes; persisted per browser. */
export function PaneLayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutState>(load);
  const [peek, setPeekState] = useState<PaneId | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem(PANE_STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Storage unavailable: layout lasts for this session only.
    }
  }, [state]);

  const toggleCollapsed = useCallback(
    (id: PaneId) =>
      setState((s) => ({
        ...s,
        collapsed: s.collapsed.includes(id)
          ? s.collapsed.filter((x) => x !== id)
          : [...s.collapsed, id],
      })),
    [],
  );
  const dock = useCallback((id: PaneId) => {
    setState((s) => (s.docked.includes(id) ? s : { ...s, docked: [...s.docked, id] }));
    setPeekState(null);
  }, []);
  const restore = useCallback((id: PaneId) => {
    setState((s) => ({ ...s, docked: s.docked.filter((x) => x !== id) }));
    setPeekState(null);
  }, []);
  const restoreAll = useCallback(() => {
    setState((s) => ({ ...s, docked: [] }));
    setPeekState(null);
  }, []);
  const restoreSide = useCallback((side: DockSide) => {
    setState((s) => ({ ...s, docked: s.docked.filter((id) => PANES[id].side !== side) }));
    setPeekState(null);
  }, []);
  const collapseAll = useCallback(() => setState((s) => ({ ...s, collapsed: [...PANE_IDS] })), []);
  const expandAll = useCallback(() => setState((s) => ({ ...s, collapsed: [] })), []);
  const setPeek = useCallback((id: PaneId | null) => setPeekState(id), []);

  const value = useMemo<PaneLayoutValue>(
    () => ({
      isCollapsed: (id) => state.collapsed.includes(id),
      isDocked: (id) => state.docked.includes(id),
      peek,
      dockedIds: PANE_IDS.filter((id) => state.docked.includes(id)),
      dockedOn: (side) =>
        PANE_IDS.filter((id) => state.docked.includes(id) && PANES[id].side === side),
      restoreSide,
      toggleCollapsed,
      dock,
      restore,
      restoreAll,
      collapseAll,
      expandAll,
      setPeek,
    }),
    [
      state,
      peek,
      toggleCollapsed,
      dock,
      restore,
      restoreAll,
      restoreSide,
      collapseAll,
      expandAll,
      setPeek,
    ],
  );
  return <PaneLayoutContext.Provider value={value}>{children}</PaneLayoutContext.Provider>;
}

const NOOP_LAYOUT: PaneLayoutValue = {
  isCollapsed: () => false,
  isDocked: () => false,
  peek: null,
  dockedIds: [],
  dockedOn: () => [],
  restoreSide: () => undefined,
  toggleCollapsed: () => undefined,
  dock: () => undefined,
  restore: () => undefined,
  restoreAll: () => undefined,
  collapseAll: () => undefined,
  expandAll: () => undefined,
  setPeek: () => undefined,
};

/** Pane layout access; everything stays open and in place outside a provider (isolated tests). */
export function usePaneLayout(): PaneLayoutValue {
  return useContext(PaneLayoutContext) ?? NOOP_LAYOUT;
}
