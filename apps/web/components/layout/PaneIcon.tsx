import type { PaneIconName } from "@/lib/panes";

const PATHS: Record<
  PaneIconName | "chevron" | "dock" | "restore" | "dockLeft" | "restoreLeft" | "close" | "expand",
  React.ReactNode
> = {
  sliders: (
    <>
      <path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="12" r="2" />
      <circle cx="17" cy="17" r="2" />
    </>
  ),
  chart: <path d="M4 20V10M10 20V4M16 20v-8M22 20H2" />,
  cube: (
    <>
      <path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" />
      <path d="M12 12l8-4.5M12 12v9M12 12L4 7.5" />
    </>
  ),
  table: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 10h18M3 15h18M9 4v16" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <circle cx="4" cy="6" r="1" />
      <circle cx="4" cy="12" r="1" />
      <circle cx="4" cy="18" r="1" />
    </>
  ),
  check: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </>
  ),
  clipboard: (
    <>
      <rect x="5" y="3" width="14" height="18" rx="2" />
      <path d="M9 3v2h6V3M9 13l2 2 4-4" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3l10 18H2L12 3z" />
      <path d="M12 10v5M12 18h.01" />
    </>
  ),
  book: (
    <>
      <path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4z" />
      <path d="M5 17a3 3 0 013-3h11" />
    </>
  ),
  chevron: <path d="M6 9l6 6 6-6" />,
  dock: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16M8 9l3 3-3 3" />
    </>
  ),
  restore: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M15 4v16M11 9l-3 3 3 3" />
    </>
  ),
  dockLeft: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M16 9l-3 3 3 3" />
    </>
  ),
  restoreLeft: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M9 4v16M13 9l3 3-3 3" />
    </>
  ),
  close: <path d="M6 6l12 12M18 6L6 18" />,
  expand: (
    <>
      <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
    </>
  ),
};

export type IconName = keyof typeof PATHS;

/** Decorative stroke icon (always paired with a text label or aria-label on the button). */
export function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
