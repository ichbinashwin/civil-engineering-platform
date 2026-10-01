// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { View3D } from "@/components/viz/View3D";
import { VisualizationPanel } from "@/components/viz/VisualizationPanel";
import { ThemeProvider } from "@/components/theme/ThemeProvider";
import { runCalc, vizOf } from "@/lib/calc";
import { EXAMPLE_FORM_ACI, EXAMPLE_FORM_EC2 } from "@/lib/form";

describe("3D view labels toggle", () => {
  afterEach(cleanup);

  it.each([
    ["ACI 318-19", EXAMPLE_FORM_ACI],
    ["EN 1992-1-1", EXAMPLE_FORM_EC2],
  ])("Labels button shows and hides the labels (%s)", (_code, form) => {
    const { input, outcome } = vizOf(runCalc(form));
    render(
      <ThemeProvider>
        <View3D input={input} outcome={outcome} selectedOpening={null} />
      </ThemeProvider>,
    );
    const labels = screen.getByRole("button", { name: "Labels" });
    expect(labels.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(labels);
    expect(labels.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(labels);
    expect(labels.getAttribute("aria-pressed")).toBe("true");
  });

  it("the legend uses the symbols of the active code", () => {
    const aci = vizOf(runCalc(EXAMPLE_FORM_ACI));
    const ec2 = vizOf(runCalc(EXAMPLE_FORM_EC2));
    const { unmount } = render(
      <ThemeProvider>
        <View3D input={aci.input} outcome={aci.outcome} selectedOpening={null} />
      </ThemeProvider>,
    );
    expect(screen.getByText(/vu,max \/ φvc/)).toBeTruthy();
    unmount();
    render(
      <ThemeProvider>
        <View3D input={ec2.input} outcome={ec2.outcome} selectedOpening={null} />
      </ThemeProvider>,
    );
    expect(screen.getByText(/vEd \/ vRd,c/)).toBeTruthy();
  });
});

describe("3D view defaults and reset on code switch", () => {
  afterEach(cleanup);

  it("spin is on by default", () => {
    const { input, outcome } = vizOf(runCalc(EXAMPLE_FORM_ACI));
    render(
      <ThemeProvider>
        <View3D input={input} outcome={outcome} selectedOpening={null} />
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: /Stop spin/ })).toBeTruthy();
  });

  it("switching the design code resets the 3D view (spin on again)", async () => {
    const aci = vizOf(runCalc(EXAMPLE_FORM_ACI));
    const ec2 = vizOf(runCalc(EXAMPLE_FORM_EC2));
    const panel = (v: typeof aci) => (
      <ThemeProvider>
        <VisualizationPanel
          input={v.input}
          outcome={v.outcome}
          selectedOpening={null}
          onSelectOpening={() => undefined}
        />
      </ThemeProvider>
    );
    const { rerender } = render(panel(aci));
    fireEvent.click(screen.getByRole("tab", { name: "3D" }));
    const stop = await screen.findByRole("button", { name: /Stop spin/ });
    fireEvent.click(stop);
    expect(screen.getByRole("button", { name: /^↻ Spin/ })).toBeTruthy();

    rerender(panel(ec2));
    expect(await screen.findByRole("button", { name: /Stop spin/ })).toBeTruthy();
    expect(screen.getByRole("tab", { name: "3D" }).getAttribute("aria-selected")).toBe("true");
  });
});
