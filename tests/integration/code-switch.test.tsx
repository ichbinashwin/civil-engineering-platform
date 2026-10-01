// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Workspace } from "@/components/workspace/Workspace";
import { runCalc } from "@/lib/calc";
import { EXAMPLE_FORM_ACI, EXAMPLE_FORM_EC2, convertFormToCode } from "@/lib/form";

const radio = (name: RegExp) => screen.getByRole("radio", { name });
const dcrLabel = (form = EXAMPLE_FORM_ACI) => {
  const c = runCalc(form);
  if (!c.outcome.ok) throw new Error(c.outcome.reason);
  return `DCR ${c.outcome.dcr.toFixed(3)}`;
};

describe("US / EU design code switch", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("defaults to the US code (ACI 318-19) with flags on both options", () => {
    render(<Workspace />);
    expect(radio(/US ACI 318-19/).getAttribute("aria-checked")).toBe("true");
    expect(radio(/EU EN 1992-1-1/).getAttribute("aria-checked")).toBe("false");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("ACI 318-19 Punching Shear");
    expect(screen.getByRole("img", { name: "United States flag" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "European Union flag" })).toBeTruthy();
    expect(screen.getByLabelText("Vu (factored shear)")).toBeTruthy();
    expect(screen.getByLabelText(dcrLabel())).toBeTruthy();
  });

  it("switching to EU converts inputs to SI, changes labels and shows the Eurocode result", () => {
    render(<Workspace />);
    fireEvent.click(radio(/EU EN 1992-1-1/));
    expect(radio(/EU EN 1992-1-1/).getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/EN 1992-1-1/);

    const vEd = screen.getByLabelText("VEd (design shear)") as HTMLInputElement;
    expect(Number(vEd.value)).toBeCloseTo(1321.1, 0); // 297 kip in kN
    expect(screen.getByLabelText("c1 (column, X)")).toBeTruthy();
    expect((screen.getByLabelText("c1 (column, X)") as HTMLInputElement).value).toBe("304.8");

    // Eurocode-only inputs appear, ACI-only ones disappear.
    expect(screen.getByLabelText("fck (cylinder strength)")).toBeTruthy();
    expect(screen.getByLabelText("ρlx (tension steel, X)")).toBeTruthy();
    expect(screen.queryByLabelText("λ (lightweight factor)")).toBeNull();
    expect(screen.queryByLabelText("Moment signs")).toBeNull();

    // The displayed DCR is exactly what the Eurocode engine returns for the converted form.
    const converted = convertFormToCode(EXAMPLE_FORM_ACI, "EN 1992-1-1");
    expect(screen.getByLabelText(dcrLabel(converted))).toBeTruthy();
    expect(screen.getAllByText(/Experimental/i).length).toBeGreaterThan(0);
  });

  it("switching back to US restores the ACI result", () => {
    render(<Workspace />);
    fireEvent.click(radio(/EU EN 1992-1-1/));
    fireEvent.click(radio(/US ACI 318-19/));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("ACI 318-19 Punching Shear");
    const dcr = Number(
      /DCR ([\d.]+)/.exec(screen.getByLabelText(/^DCR \d/).getAttribute("aria-label") ?? "")?.[1],
    );
    expect(dcr).toBeCloseTo(Number(/([\d.]+)$/.exec(dcrLabel())?.[1]), 1);
  });

  it("recalculates live in EU mode and flags invalid input", () => {
    render(<Workspace />);
    fireEvent.click(radio(/EU EN 1992-1-1/));
    fireEvent.change(screen.getByLabelText("VEd (design shear)"), { target: { value: "5000" } });
    expect(screen.getAllByText("FAIL").length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText("fck (cylinder strength)"), { target: { value: "5" } });
    expect(screen.getByText("CALCULATION UNAVAILABLE")).toBeTruthy();
    expect(screen.getAllByText(/outside the concrete classes/).length).toBeGreaterThan(0);
  });

  it("Reset example loads the example of the selected code", () => {
    render(<Workspace />);
    fireEvent.click(radio(/EU EN 1992-1-1/));
    fireEvent.change(screen.getByLabelText("VEd (design shear)"), { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "Reset example" }));
    expect((screen.getByLabelText("VEd (design shear)") as HTMLInputElement).value).toBe(
      EXAMPLE_FORM_EC2.Vu,
    );
  });

  it("a review is outdated after switching code (the engine input changed)", () => {
    render(<Workspace />);
    fireEvent.change(screen.getByLabelText("Reviewer"), { target: { value: "A. Engineer" } });
    fireEvent.click(screen.getByRole("button", { name: "Mark as reviewed" }));
    expect(screen.getByText("REVIEWED")).toBeTruthy();
    fireEvent.click(radio(/EU EN 1992-1-1/));
    expect(screen.getByText("REVIEW OUTDATED")).toBeTruthy();
  });

  it("remembers the code across reloads and treats old saved data as US", () => {
    const first = render(<Workspace />);
    fireEvent.click(radio(/EU EN 1992-1-1/));
    first.unmount();
    render(<Workspace />);
    expect(radio(/EU EN 1992-1-1/).getAttribute("aria-checked")).toBe("true");
    cleanup();

    const legacy: Partial<typeof EXAMPLE_FORM_ACI> = { ...EXAMPLE_FORM_ACI };
    delete legacy.code; // saved before the code selector existed
    window.localStorage.setItem(
      "civil-platform:punching:v1",
      JSON.stringify({ form: legacy, review: null }),
    );
    render(<Workspace />);
    expect(radio(/US ACI 318-19/).getAttribute("aria-checked")).toBe("true");
  });
});

describe("engineering compliance checklist", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  const panel = () =>
    screen
      .getByRole("heading", { name: "Compliance checklist", level: 2 })
      .closest("section") as HTMLElement;

  it("lists common items plus the items of the active code", () => {
    render(<Workspace />);
    const p = within(panel());
    expect(p.getByLabelText(/Independent engineer review completed/)).toBeTruthy();
    expect(p.getByLabelText(/ACI 318-19 and its adoption by the local building code/)).toBeTruthy();
    expect(p.queryByLabelText(/National Annex of the project country/)).toBeNull();

    fireEvent.click(radio(/EU EN 1992-1-1/));
    const eu = within(panel());
    expect(eu.getByLabelText(/Independent engineer review completed/)).toBeTruthy();
    expect(eu.getByLabelText(/National Annex of the project country/)).toBeTruthy();
    expect(eu.getByLabelText(/mean tension-reinforcement ratio/)).toBeTruthy();
    expect(eu.queryByLabelText(/adoption by the local building code/)).toBeNull();
  });

  it("confirmations are ticked by the engineer, counted, saved, and never recalculate the result", () => {
    render(<Workspace />);
    const before = screen.getByLabelText(dcrLabel()).textContent;
    const p = within(panel());
    const item = p.getByLabelText(/Independent engineer review completed/) as HTMLInputElement;
    expect(item.checked).toBe(false);
    fireEvent.click(item);
    expect(item.checked).toBe(true);
    expect(screen.getByLabelText(/1 of \d+ confirmations ticked/)).toBeTruthy();
    expect(
      JSON.parse(window.localStorage.getItem("civil-platform:punching:v1")!).form.checklist[
        "independent-review"
      ],
    ).toBe(true);
    expect(screen.getByLabelText(dcrLabel()).textContent).toBe(before);
    fireEvent.click(p.getByRole("button", { name: "Clear" }));
    expect(item.checked).toBe(false);
    fireEvent.click(p.getByRole("button", { name: "Tick all" }));
    expect(item.checked).toBe(true);
  });

  it("automatic checks come from the calculation and cannot be edited", () => {
    render(<Workspace />);
    const auto = within(panel()).getByLabelText(
      "Demand / capacity ratio ≤ 1.00",
    ) as HTMLInputElement;
    expect(auto.disabled).toBe(true);
    expect(auto.checked).toBe(true);
    fireEvent.change(screen.getByLabelText("Vu (factored shear)"), { target: { value: "900" } });
    expect(
      (within(panel()).getByLabelText("Demand / capacity ratio ≤ 1.00") as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (
        within(panel()).getByLabelText(
          "Size-effect factor λs applied (§22.5.5.1.3)",
        ) as HTMLInputElement
      ).checked,
    ).toBe(true);
  });
});
