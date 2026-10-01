// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { DEFAULT_MODE, DEFAULT_THEME } from "../../apps/web/lib/theme";
import {
  WALLPAPER_DOODLE_COUNT,
  WALLPAPER_EMOJIS,
  WALLPAPER_ICON_NAMES,
  buildWallpaperSvg,
  wallpaperCssUrl,
} from "../../apps/web/lib/wallpaper";

const OPTIONS = { color: "#7f9bb8", lineOpacity: 0.2, emojiOpacity: 0.14 };

describe("engineering doodle wallpaper", () => {
  const svg = buildWallpaperSvg(OPTIONS);

  it("is well-formed SVG", () => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelector("parsererror")).toBeNull();
    expect(doc.documentElement.nodeName).toBe("svg");
  });

  it("is deterministic (same tile every render and build)", () => {
    expect(buildWallpaperSvg(OPTIONS)).toBe(svg);
  });

  it("places one doodle per grid cell, mixing line icons and emojis", () => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const icons = doc.querySelectorAll("g[stroke] > g:not([data-copy])").length;
    const emojis = doc.querySelectorAll("text:not([data-copy])").length;
    expect(icons + emojis).toBe(WALLPAPER_DOODLE_COUNT);
    expect(icons).toBeGreaterThan(10);
    expect(emojis).toBeGreaterThan(3);
  });

  it("doodles are small like a chat wallpaper", () => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    const scales = [...doc.querySelectorAll("g[stroke] > g")].map((g) =>
      Number(/scale\(([\d.]+)\)/.exec(g.getAttribute("transform") ?? "")?.[1]),
    );
    expect(Math.max(...scales) * 48).toBeLessThanOrEqual(32); // icon box 48 units -> at most ~32 px
    const sizes = [...doc.querySelectorAll("text")].map((t) => Number(t.getAttribute("font-size")));
    expect(Math.max(...sizes)).toBeLessThanOrEqual(18);
    expect(WALLPAPER_DOODLE_COUNT).toBeGreaterThanOrEqual(80);
  });

  it("is seamless: doodles near an edge are repeated on the opposite edge", () => {
    const doc = new DOMParser().parseFromString(svg, "image/svg+xml");
    expect(doc.querySelectorAll("[data-copy]").length).toBeGreaterThan(0);
    const xs = [...doc.querySelectorAll("[transform^='translate(']")].map((el) =>
      Number(/translate\((-?[\d.]+)/.exec(el.getAttribute("transform") ?? "")?.[1]),
    );
    expect(xs.some((x) => x >= 520)).toBe(true);
    expect(xs.some((x) => x < 0)).toBe(true);
  });

  it("uses only civil and structural engineering subjects", () => {
    expect(WALLPAPER_ICON_NAMES).toEqual(
      expect.arrayContaining(["iBeam", "truss", "bridge", "crane", "hardHat", "rcSection"]),
    );
    expect(WALLPAPER_EMOJIS).toEqual(expect.arrayContaining(["👷", "🏗️", "🌉", "📐"]));
  });

  it("takes color and strength from the theme", () => {
    const other = buildWallpaperSvg({ ...OPTIONS, color: "#123456", lineOpacity: 0.5 });
    expect(other).toContain('stroke="#123456"');
    expect(other).toContain('stroke-opacity="0.5"');
  });

  it("has no scripts or external references (safe as a CSS data URI)", () => {
    expect(svg).not.toMatch(/<script|href=|xlink|url\(http/i);
    const css = wallpaperCssUrl(OPTIONS);
    expect(css.startsWith('url("data:image/svg+xml,')).toBe(true);
    expect(css).not.toContain('"data:image/svg+xml,<');
  });
});

describe("theme defaults", () => {
  it("default to Blueprint in Dark mode", () => {
    expect(DEFAULT_THEME).toBe("blueprint");
    expect(DEFAULT_MODE).toBe("dark");
  });
});
