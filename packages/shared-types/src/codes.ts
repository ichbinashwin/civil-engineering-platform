/** Design codes the platform is architected to support. Only ACI 318-19 is implemented. */
export type DesignCode = "ACI 318-19";

/** Traceable pointer to a code provision used by a calculation step. */
export interface CodeReference {
  code: string;
  edition: string;
  section: string;
  description: string;
}
