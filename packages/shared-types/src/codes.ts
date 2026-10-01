/**
 * Design codes the platform supports for punching shear:
 * "ACI 318-19" (US, inch-pound) and "EN 1992-1-1" (Eurocode 2, EU, SI; recommended National Annex values).
 */
export type DesignCode = "ACI 318-19" | "EN 1992-1-1";

/** Traceable pointer to a code provision used by a calculation step. */
export interface CodeReference {
  code: string;
  edition: string;
  section: string;
  description: string;
}
