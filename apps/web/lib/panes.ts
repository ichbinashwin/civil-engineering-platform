/**
 * Dashboard panes (containers). Each pane can be collapsed in place, or docked into the
 * icon rail at the right edge and peeked from there. Presentation only.
 */
export const PANE_IDS = [
  "inputs",
  "kpis",
  "viz",
  "tables",
  "trace",
  "result",
  "review",
  "messages",
  "refs",
] as const;

export type PaneId = (typeof PANE_IDS)[number];

export type PaneIconName =
  "sliders" | "chart" | "cube" | "table" | "list" | "check" | "clipboard" | "alert" | "book";

export type DockSide = "left" | "right";

export interface PaneDefinition {
  title: string;
  /**
   * Sidebar this pane docks to: panes of the left column dock left, panes of the right column dock
   * right. The wide centre panes dock right.
   */
  side: DockSide;
  icon: PaneIconName;
  /** Flyout width (px) when peeked from the rail. */
  flyoutWidth: number;
  /** Collapsed on first visit. */
  defaultCollapsed?: boolean;
}

export const PANES: Record<PaneId, PaneDefinition> = {
  inputs: { title: "Design Inputs", side: "left", icon: "sliders", flyoutWidth: 420 },
  kpis: { title: "Key results", side: "right", icon: "chart", flyoutWidth: 640 },
  viz: { title: "Engineering Visualization", side: "right", icon: "cube", flyoutWidth: 760 },
  tables: { title: "Calculation tables", side: "right", icon: "table", flyoutWidth: 760 },
  trace: {
    title: "Calculation trace",
    side: "right",
    icon: "list",
    flyoutWidth: 760,
    defaultCollapsed: true,
  },
  result: { title: "Result", side: "right", icon: "check", flyoutWidth: 420 },
  review: { title: "Engineer review", side: "right", icon: "clipboard", flyoutWidth: 420 },
  messages: { title: "Engineering messages", side: "right", icon: "alert", flyoutWidth: 460 },
  refs: { title: "Code references", side: "right", icon: "book", flyoutWidth: 460 },
};

export const PANE_STORAGE_KEY = "civil-platform:panes:v1";

export function isPaneId(value: unknown): value is PaneId {
  return typeof value === "string" && (PANE_IDS as readonly string[]).includes(value);
}
