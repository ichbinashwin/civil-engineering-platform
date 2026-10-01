/**
 * Engine version recorded in every calculation result for auditability. Bump on any formula change.
 * 0.2.0: result model extended (stress profile, opening shadows); formulas unchanged from 0.1.0.
 * 0.3.0: product of inertia Jxy in the biaxial stress formula (affects asymmetric openings only);
 *        optional signed moment convention. Validated against CSI ACI 318-14 RC-PN-001.
 */
export const ENGINE_VERSION = "0.3.0";
