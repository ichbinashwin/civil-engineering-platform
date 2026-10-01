import { describe, expect, it } from "vitest";
import {
  AUTO_DARK_FROM_HOUR,
  AUTO_LIGHT_FROM_HOUR,
  detectTimeZone,
  nextAutoSwitch,
  resolveAutoMode,
} from "../../apps/web/lib/theme";

/** Dates are built from local calendar fields, so the tests hold in any machine timezone. */
const local = (h: number, m = 0, day = 1) => new Date(2026, 9, day, h, m, 0, 0);

describe("Auto color mode follows local time of day", () => {
  it("is dark at night and light during the day", () => {
    expect(resolveAutoMode(local(0, 30))).toBe("dark");
    expect(resolveAutoMode(local(6, 59))).toBe("dark");
    expect(resolveAutoMode(local(AUTO_LIGHT_FROM_HOUR))).toBe("light");
    expect(resolveAutoMode(local(12))).toBe("light");
    expect(resolveAutoMode(local(AUTO_DARK_FROM_HOUR - 1, 59))).toBe("light");
    expect(resolveAutoMode(local(AUTO_DARK_FROM_HOUR))).toBe("dark");
    expect(resolveAutoMode(local(23, 59))).toBe("dark");
  });

  it("finds the next 07:00 / 19:00 boundary", () => {
    expect(nextAutoSwitch(local(3)).getTime()).toBe(local(7).getTime());
    expect(nextAutoSwitch(local(7)).getTime()).toBe(local(19).getTime());
    expect(nextAutoSwitch(local(18, 59)).getTime()).toBe(local(19).getTime());
    expect(nextAutoSwitch(local(19)).getTime()).toBe(local(7, 0, 2).getTime());
    expect(nextAutoSwitch(local(23)).getTime()).toBe(local(7, 0, 2).getTime());
  });

  it("rolls over month ends", () => {
    const lastNight = new Date(2026, 9, 31, 22, 0);
    expect(nextAutoSwitch(lastNight).getTime()).toBe(new Date(2026, 10, 1, 7, 0).getTime());
  });

  it("reports the browser timezone", () => {
    expect(detectTimeZone().length).toBeGreaterThan(0);
  });
});
