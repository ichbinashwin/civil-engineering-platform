import type { CalculationStatus } from "@civil/shared-types";

/** Status is always conveyed as text, never by color alone. */
export function StatusBadge({ status }: { status: CalculationStatus }) {
  const color =
    status === "PASS"
      ? "text-pass border-pass"
      : status === "FAIL"
        ? "text-fail border-fail"
        : "text-warn border-warn";
  return (
    <span
      role="status"
      className={`inline-block border-2 px-3 py-1 font-mono text-lg font-bold tracking-wider ${color}`}
    >
      {status}
    </span>
  );
}
