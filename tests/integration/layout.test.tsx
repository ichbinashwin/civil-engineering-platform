// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { Workspace } from "@/components/workspace/Workspace";
import { PANE_IDS, PANE_STORAGE_KEY, PANES } from "@/lib/panes";

const pane = (title: string) =>
  screen.getByRole("heading", { name: title, level: 2 }).closest("section") as HTMLElement;

/** The collapse toggle's accessible name is the visible title; aria-expanded carries the state. */
const toggleOf = (title: string) => within(pane(title)).getByRole("button", { name: title });

describe("collapsible and dockable dashboard panes", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("every container is a pane with a collapse toggle and a dock button", () => {
    render(<Workspace />);
    for (const id of PANE_IDS) {
      const title = PANES[id].title;
      expect(screen.getByRole("heading", { name: title, level: 2 })).toBeTruthy();
      expect(screen.getByRole("button", { name: `Move ${title} to the sidebar` })).toBeTruthy();
    }
  });

  it("collapses in place, keeps the header, and keeps state when re-expanded", () => {
    render(<Workspace />);
    const toggle = toggleOf("Design Inputs");
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    const vu = screen.getByLabelText("Vu (factored shear)") as HTMLInputElement;
    fireEvent.change(vu, { target: { value: "350" } });
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(vu.closest("[hidden]")).not.toBeNull();
    fireEvent.click(toggle);
    expect((screen.getByLabelText("Vu (factored shear)") as HTMLInputElement).value).toBe("350");
  });

  it("calculation trace starts collapsed", () => {
    render(<Workspace />);
    expect(toggleOf("Calculation trace").getAttribute("aria-expanded")).toBe("false");
    expect(toggleOf("Design Inputs").getAttribute("aria-expanded")).toBe("true");
  });

  it("docks a pane to the sidebar rail as an icon, then peeks and restores it", () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "Move Design Inputs to the sidebar" }));
    const rail = screen.getByRole("navigation", { name: "Docked panels" });
    const iconButton = within(rail).getByRole("button", {
      name: /Design Inputs \(in sidebar\) — open/,
    });
    expect(pane("Design Inputs").className).toContain("docked");
    expect(pane("Design Inputs").className).not.toContain("peek");

    fireEvent.click(iconButton);
    expect(pane("Design Inputs").className).toContain("peek");
    expect(iconButton.getAttribute("aria-pressed")).toBe("true");

    fireEvent.keyDown(window, { key: "Escape" });
    expect(pane("Design Inputs").className).not.toContain("peek");

    fireEvent.click(iconButton);
    fireEvent.click(screen.getByRole("button", { name: "Restore Design Inputs to the dashboard" }));
    expect(pane("Design Inputs").className).not.toContain("docked");
    expect(screen.queryByRole("navigation", { name: "Docked panels" })).toBeNull();
  });

  it("a docked pane stays live: inputs still drive the calculation", () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "Move Design Inputs to the sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: /Design Inputs \(in sidebar\)/ }));
    fireEvent.change(screen.getByLabelText("Vu (factored shear)"), { target: { value: "500" } });
    expect(screen.getAllByText("FAIL").length).toBeGreaterThan(0);
  });

  it("Collapse all / Expand all / Restore sidebar panels", () => {
    render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse all" }));
    for (const id of PANE_IDS) {
      expect(toggleOf(PANES[id].title).getAttribute("aria-expanded")).toBe("false");
    }
    fireEvent.click(screen.getByRole("button", { name: "Expand all" }));
    fireEvent.click(screen.getByRole("button", { name: "Move Result to the sidebar" }));
    fireEvent.click(screen.getByRole("button", { name: /Restore sidebar panels \(1\)/ }));
    expect(screen.queryByRole("navigation", { name: "Docked panels" })).toBeNull();
  });

  it("persists layout across reloads", () => {
    const first = render(<Workspace />);
    fireEvent.click(screen.getByRole("button", { name: "Move Engineer review to the sidebar" }));
    first.unmount();
    expect(JSON.parse(window.localStorage.getItem(PANE_STORAGE_KEY)!).docked).toEqual(["review"]);
    render(<Workspace />);
    expect(pane("Engineer review").className).toContain("docked");
    expect(screen.getByRole("navigation", { name: "Docked panels" })).toBeTruthy();
  });

  it("ignores corrupt stored layout", () => {
    window.localStorage.setItem(PANE_STORAGE_KEY, '{"docked":["nope",7],"collapsed":"x"}');
    render(<Workspace />);
    expect(screen.queryByRole("navigation", { name: "Docked panels" })).toBeNull();
  });
});
