import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { calculatePunchingShear } from "@civil/engineering-core";
import type { PunchingShearInput } from "@civil/shared-types";
import { REFERENCE_CASE, referenceWith } from "../fixtures/punching-reference";

/**
 * Guards that adding other design codes never changes ACI 318-19 results: the complete result object of
 * several inputs is compared with a golden snapshot taken before the Eurocode 2 module was added.
 * Only meta.engineVersion may differ. Regenerate deliberately (and bump ENGINE_VERSION + docs) with
 * UPDATE_GOLDEN=1 pnpm test:regression after a reviewed ACI formula change.
 */
const GOLDEN_PATH = fileURLToPath(new URL("./aci-golden.json", import.meta.url));

const INPUTS: Record<string, PunchingShearInput> = {
  reference: REFERENCE_CASE,
  referenceNoSizeEffect: { ...REFERENCE_CASE, options: { applySizeEffectFactor: false } },
  referenceSigned: { ...REFERENCE_CASE, options: { momentSignConvention: "signed" } },
  noOpenings: referenceWith({ openings: [] }),
  rectangularOpening: referenceWith({
    openings: [{ type: "rectangle", centerX: 40, centerY: 45, width: 12, height: 8 }],
  }),
  highShear: referenceWith({ Vu: 600_000 }),
  csiRcPn001: {
    Vu: 189_450,
    Mux: -2_480_000,
    Muy: 1_790_000,
    column: { c1: 12, c2: 36 },
    d: 8.5,
    slabThickness: 10,
    concrete: { fc: 4000, lambda: 1 },
    openings: [],
    columnLocation: "interior",
    punchingReinforcement: "none",
  },
};

function snapshot(): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(INPUTS).map(([name, input]) => {
      const result = calculatePunchingShear(input);
      const json = JSON.parse(JSON.stringify(result)) as { meta?: { engineVersion?: string } };
      if (json.meta) delete json.meta.engineVersion;
      return [name, json];
    }),
  );
}

describe("ACI 318-19 results are unchanged", () => {
  if (process.env.UPDATE_GOLDEN === "1" || !existsSync(GOLDEN_PATH)) {
    writeFileSync(GOLDEN_PATH, `${JSON.stringify(snapshot(), null, 1)}\n`);
  }
  const golden = JSON.parse(readFileSync(GOLDEN_PATH, "utf8")) as Record<string, unknown>;
  const current = snapshot();

  it.each(Object.keys(INPUTS))("%s is identical to the golden snapshot", (name) => {
    expect(current[name]).toEqual(golden[name]);
  });
});
