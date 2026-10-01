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

export interface PaneDefinition {
  title: string;
  icon: PaneIconName;
  /** Flyout width (px) when peeked from the rail. */
  flyoutWidth: number;
  /** Collapsed on first visit. */
  defaultCollapsed?: boolean;
}

export const PANES: Record<PaneId, PaneDefinition> = {
  inputs: { title: "Design Inputs", icon: "sliders", flyoutWidth: 420 },
  kpis: { title: "Key results", icon: "chart", flyoutWidth: 640 },
  viz: { title: "Engineering Visualization", icon: "cube", flyoutWidth: 760 },
  tables: { title: "Calculation tables", icon: "table", flyoutWidth: 760 },
  trace: { title: "Calculation trace", icon: "list", flyoutWidth: 760, defaultCollapsed: true },
  result: { title: "Result", icon: "check", flyoutWidth: 420 },
  review: { title: "Engineer review", icon: "clipboard", flyoutWidth: 420 },
  messages: { title: "Engineering messages", icon: "alert", flyoutWidth: 460 },
  refs: { title: "Code references", icon: "book", flyoutWidth: 460 },
};

export const PANE_STORAGE_KEY = "civil-platform:panes:v1";

export function isPaneId(value: unknown): value is PaneId {
  return typeof value === "string" && (PANE_IDS as readonly string[]).includes(value);
}
