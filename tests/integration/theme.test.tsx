// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
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

  it("first visit: Blueprint theme in Dark mode with the doodle wallpaper on", () => {
    render(<ThemedWorkspace />);
    const root = document.documentElement;
    expect(root.dataset.theme).toBe("blueprint");
    expect(root.dataset.mode).toBe("dark");
    expect((screen.getByLabelText("Theme") as HTMLSelectElement).value).toBe("blueprint");
    expect(screen.getByRole("button", { name: /Dark/ }).getAttribute("aria-pressed")).toBe("true");
    expect(root.style.getPropertyValue("--wallpaper")).toContain("data:image/svg+xml");
  });

  it("wallpaper toggle removes and restores the pattern, and is remembered", () => {
    render(<ThemedWorkspace />);
    const button = screen.getByRole("button", { name: /Wallpaper/ });
    expect(button.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(button);
    expect(document.documentElement.style.getPropertyValue("--wallpaper")).toBe("none");
    expect(JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY)!).wallpaper).toBe(false);
    fireEvent.click(button);
    expect(document.documentElement.style.getPropertyValue("--wallpaper")).toContain(
      "data:image/svg+xml",
    );
  });

  it("applies theme palette as CSS variables and persists the choice", () => {
    render(<ThemedWorkspace />);
    fireEvent.change(screen.getByLabelText("Theme"), { target: { value: "concrete" } });
    fireEvent.click(screen.getByRole("button", { name: /Light/ }));
    const root = document.documentElement;
    expect(root.dataset.theme).toBe("concrete");
    expect(root.dataset.mode).toBe("light");
    expect(root.style.getPropertyValue(cssVarName("canvas"))).toBe(THEMES.concrete.light.canvas);
    expect(JSON.parse(window.localStorage.getItem(THEME_STORAGE_KEY)!)).toMatchObject({
      themeId: "concrete",
      mode: "light",
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

  describe("Auto mode switches by local time", () => {
    afterEach(() => vi.useRealTimers());

    const mount = (hour: number) => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date(2026, 9, 1, hour, 0, 0));
      render(<ThemedWorkspace />);
      fireEvent.click(screen.getByRole("button", { name: /Auto/ }));
    };

    it("is dark at 22:00 and light at 10:00", () => {
      mount(22);
      expect(document.documentElement.dataset.mode).toBe("dark");
      cleanup();
      mount(10);
      expect(document.documentElement.dataset.mode).toBe("light");
    });

    it("switches at the 19:00 and 07:00 boundaries without a reload", () => {
      mount(18);
      expect(document.documentElement.dataset.mode).toBe("light");
      act(() => {
        vi.advanceTimersByTime(61 * 60 * 1000); // 19:01
      });
      expect(document.documentElement.dataset.mode).toBe("dark");
      act(() => {
        vi.advanceTimersByTime(12 * 60 * 60 * 1000); // 07:01 next day
      });
      expect(document.documentElement.dataset.mode).toBe("light");
    });

    it("re-checks the clock when the tab regains focus (sleep / timezone change)", () => {
      mount(10);
      expect(document.documentElement.dataset.mode).toBe("light");
      vi.setSystemTime(new Date(2026, 9, 1, 23, 0, 0)); // clock jumped while asleep
      act(() => {
        window.dispatchEvent(new Event("focus"));
      });
      expect(document.documentElement.dataset.mode).toBe("dark");
    });

    it("explains the schedule and timezone in the Auto button tooltip", () => {
      mount(10);
      const title = screen.getByRole("button", { name: /Auto/ }).getAttribute("title") ?? "";
      expect(title).toMatch(/time of day/);
      expect(title).toMatch(/07:00–19:00/);
      expect(title).toMatch(/now light/);
    });
  });
});
