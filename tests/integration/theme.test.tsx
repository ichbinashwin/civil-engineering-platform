// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ThemedWorkspace } from "@/components/workspace/ThemedWorkspace";
import { THEMES, THEME_IDS, THEME_STORAGE_KEY, cssVarName } from "@/lib/theme";

describe("themes and color mode", () => {
  beforeEach(() => window.localStorage.clear());
  afterEach(cleanup);

  it("offers three engineering themes", () => {
    render(<ThemedWorkspace />);
    const select = screen.getByLabelText("Theme") as HTMLSelectElement;
    expect([...select.options].map((o) => o.text)).toEqual(THEME_IDS.map((id) => THEMES[id].name));
  });

  it("applies theme palette as CSS variables and persists the choice", () => {
    render(<ThemedWorkspace />);
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "blueprint" } });
    fireEvent.click(screen.getByRole("button", { name: /Dark/ }));
    const root = document.documentElement;
    expect(root.dataset.theme).toBe("blueprint");
    expect(root.dataset.mode).toBe("dark");
    expect(root.style.getPropertyValue(cssVarName("canvas"))).toBe(THEMES.blueprint.dark.canvas);
    expect(JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY)!)).toEqual({
      themeId: "blueprint",
      mode: "dark",
    });
  });

  it("Light / Dark / Auto toggle reflects the pressed state", () => {
    render(<ThemedWorkspace />);
    fireEvent.click(screen.getByRole("button", { name: /Light/ }));
    expect(screen.getByRole("button", { name: /Light/ }).getAttribute("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.mode).toBe("light");
    fireEvent.click(screen.getByRole("button", { name: /Auto/ }));
    expect(screen.getByRole("button", { name: /Auto/ }).getAttribute("aria-pressed")).toBe("true");
  });

  it("every theme defines the same palette keys in light and dark", () => {
    const keys = Object.keys(THEMES.structural.light).sort();
    for (const id of THEME_IDS) {
      expect(Object.keys(THEMES[id].light).sort()).toEqual(keys);
      expect(Object.keys(THEMES[id].dark).sort()).toEqual(keys);
    }
  });
});
