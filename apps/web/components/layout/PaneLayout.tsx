"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  /** True when the flyout was opened by a click (stays until closed); false when opened by hover. */
  peekPinned: boolean;
  /** Rail icon hover: open the flyout (not pinned) and cancel any pending close. */
  hoverEnter: (id: PaneId) => void;
  /** Pointer left a rail icon or a flyout: close an unpinned flyout after a short grace period. */
  hoverLeave: () => void;
  /** Keep an unpinned flyout open while the pointer is over it. */
  hoverKeep: () => void;
  /** Rail icon click: pin the flyout open, or close it if it is already pinned. */
  togglePinned: (id: PaneId) => void;
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

/** Grace period so the pointer can travel from a rail icon to its flyout. */
const HOVER_CLOSE_DELAY_MS = 280;

const PaneLayoutContext = createContext<PaneLayoutValue | null>(null);

/** Layout state for collapsible / dockable panes; persisted per browser. */
export function PaneLayoutProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<LayoutState>(load);
  const [peek, setPeekState] = useState<PaneId | null>(null);
  const [peekPinned, setPeekPinned] = useState(false);
  const closeTimer = useRef<number | undefined>(undefined);

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
    setPeekPinned(false);
  }, []);
  const restore = useCallback((id: PaneId) => {
    setState((s) => ({ ...s, docked: s.docked.filter((x) => x !== id) }));
    setPeekState(null);
    setPeekPinned(false);
  }, []);
  const restoreAll = useCallback(() => {
    setState((s) => ({ ...s, docked: [] }));
    setPeekState(null);
    setPeekPinned(false);
  }, []);
  const restoreSide = useCallback((side: DockSide) => {
    setState((s) => ({ ...s, docked: s.docked.filter((id) => PANES[id].side !== side) }));
    setPeekState(null);
    setPeekPinned(false);
  }, []);
  const collapseAll = useCallback(() => setState((s) => ({ ...s, collapsed: [...PANE_IDS] })), []);
  const expandAll = useCallback(() => setState((s) => ({ ...s, collapsed: [] })), []);
  const clearCloseTimer = useCallback(() => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = undefined;
  }, []);
  const setPeek = useCallback(
    (id: PaneId | null) => {
      clearCloseTimer();
      setPeekState(id);
      setPeekPinned(id !== null);
    },
    [clearCloseTimer],
  );
  const hoverEnter = useCallback(
    (id: PaneId) => {
      clearCloseTimer();
      setPeekState((current) => {
        if (current !== id) setPeekPinned(false);
        return id;
      });
    },
    [clearCloseTimer],
  );
  const hoverKeep = clearCloseTimer;
  const hoverLeave = useCallback(() => {
    clearCloseTimer();
    closeTimer.current = window.setTimeout(() => {
      setPeekPinned((pinned) => {
        if (!pinned) setPeekState(null);
        return pinned;
      });
    }, HOVER_CLOSE_DELAY_MS);
  }, [clearCloseTimer]);
  const togglePinned = useCallback(
    (id: PaneId) => {
      clearCloseTimer();
      if (peek === id && peekPinned) {
        setPeekState(null);
        setPeekPinned(false);
      } else {
        setPeekState(id);
        setPeekPinned(true);
      }
    },
    [clearCloseTimer, peek, peekPinned],
  );
  useEffect(() => clearCloseTimer, [clearCloseTimer]);

  const value = useMemo<PaneLayoutValue>(
    () => ({
      isCollapsed: (id) => state.collapsed.includes(id),
      isDocked: (id) => state.docked.includes(id),
      peek,
      peekPinned,
      hoverEnter,
      hoverLeave,
      hoverKeep,
      togglePinned,
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
      peekPinned,
      hoverEnter,
      hoverLeave,
      hoverKeep,
      togglePinned,
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
  peekPinned: false,
  hoverEnter: () => undefined,
  hoverLeave: () => undefined,
  hoverKeep: () => undefined,
  togglePinned: () => undefined,
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
