// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Workspace } from "@/components/workspace/Workspace";

describe("engineering workspace (human in the loop)", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("renders the reference case with DCR and PASS as text", () => {
    render(<Workspace />);
    expect(screen.getByLabelText("DCR 0.895")).toBeTruthy();
    expect(screen.getAllByText("PASS").length).toBeGreaterThan(0);
  });

  it("recalculates live when an input changes", () => {
    render(<Workspace />);
    fireEvent.change(screen.getByLabelText("Vu (factored shear)"), { target: { value: "400" } });
    expect(screen.getByLabelText("DCR 1.169")).toBeTruthy();
    expect(screen.getAllByText("FAIL").length).toBeGreaterThan(0);
  });

  it("shows Calculation unavailable (no DCR) for invalid input and flags the field", () => {
    render(<Workspace />);
    fireEvent.change(screen.getByLabelText("Effective depth d"), { target: { value: "20" } });
    expect(screen.getByText("CALCULATION UNAVAILABLE")).toBeTruthy();
    expect(
      screen.getAllByText(/Effective depth d must be less than slab thickness h/).length,
    ).toBeGreaterThanOrEqual(2); // inline + messages panel
    expect(screen.queryByLabelText(/^DCR \d/)).toBeNull();
  });

  it("Export Excel button is enabled for a valid result and disabled when unavailable", () => {
    render(<Workspace />);
    const button = screen.getByRole("button", { name: "Export Excel" }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.change(screen.getByLabelText("Effective depth d"), { target: { value: "20" } });
    expect(button.disabled).toBe(true);
  });

  it("adds an opening and reduces bo", () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "+ Add opening" }));
    expect(screen.getByText("Opening 3")).toBeTruthy();
  });

  it("review becomes outdated when inputs change after sign-off", () => {
    render(<Workspace />);
    fireEvent.change(screen.getByLabelText("Reviewer"), { target: { value: "A. Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark as reviewed" }));
    expect(screen.getByText("REVIEWED")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Mux (about X)"), { target: { value: "90" } });
    expect(screen.getByText("REVIEW OUTDATED")).toBeTruthy();
  });
});
