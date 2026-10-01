/**
 * Engine version recorded in every calculation result for auditability. Bump on any formula change.
 * 0.2.0: result model extended (stress profile, opening shadows); formulas unchanged from 0.1.0.
 * 0.3.0: product of inertia Jxy in the biaxial stress formula (affects asymmetric openings only);
 *        optional signed moment convention. Validated against CSI ACI 318-14 RC-PN-001.
 * 0.4.0: EN 1992-1-1 (Eurocode 2) punching shear added as a separate module; ACI 318-19 formulas unchanged.
 */
export const ENGINE_VERSION = "0.4.0";
