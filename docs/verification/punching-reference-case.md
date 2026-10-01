# Verification — punching shear reference case

Source: working calculation supplied with the project brief.

Input: Vu = 297 kip, Mux = 83.7 kip-ft, Muy = 6.0 kip-ft, column 12 × 20 in (c1 along X), d = 16 in,
h = 18 in (assumed; not in source), f'c = 5000 psi, λ = 1.0, interior, no shear reinforcement.
Openings: Ø3 in at (−47, 10) in; Ø2 in at (−30, 45) in.

Test: `tests/regression/punching-reference-case.test.ts`.

## Reproduction of the working calculation (λs omitted)

| Quantity            | Reference   | Engine             | Tolerance | Result                    |
| ------------------- | ----------- | ------------------ | --------- | ------------------------- |
| bo gross            | 128.00 in   | 128.000 in         | ±1e-6     | match                     |
| Opening 1 reduction | ≈0.914 in   | 0.9141 in          | ±0.0005   | match                     |
| Opening 2 reduction | ≈0.962 in   | 0.9618 in          | ±0.0005   | match                     |
| bo effective        | ≈126.124 in | 126.1241 in        | ±0.005    | match                     |
| vu,max              | ≈165 psi    | 166.55 psi         | ±2 psi    | within tolerance (+0.9 %) |
| vc                  | ≈282.8 psi  | 282.84 psi (eq. a) | ±0.05     | match                     |
| φvc                 | ≈212.1 psi  | 212.13 psi         | ±0.05     | match                     |
| DCR                 | ≈0.78       | 0.785              | ±0.01     | match                     |
| Status              | PASS        | PASS               | —         | match                     |

Intermediate engine values: centroid (0.193, −0.159) in, γvx = 0.4305, γvy = 0.3703,
Jx = 433 816 in⁴, Jy = 297 956 in⁴, vuv = 147.18 psi, vux = 18.10 psi, vuy = 1.27 psi,
critical point (−14, 18) in.

**vu,max difference**: the source states ≈165 psi without documenting its section-property treatment.
The engine uses the generalized R8.4.4.2.3 Jc (including d³ torsional terms) on the reduced perimeter.
Using ACI 421.1R-style J without d³ terms gives 167.7 psi. The 1–2 psi spread is documented, not tuned away.

## Finding — size-effect factor λs

ACI 318-19 Table 22.6.5.2 multiplies all three vc expressions by λs (§22.5.5.1.3). For d = 16 in,
λs = √(2/2.6) = 0.877. The working calculation uses vc = 4√f'c = 282.8 psi, i.e. λs = 1.0.

|        | Working calc (λs = 1) | ACI 318-19 (λs = 0.877) |
| ------ | --------------------- | ----------------------- |
| vc     | 282.8 psi             | 248.1 psi               |
| φvc    | 212.1 psi             | 186.1 psi               |
| DCR    | 0.785                 | 0.895                   |
| Status | PASS                  | PASS                    |

The engine applies λs by default. **Engineer action**: confirm against the published ACI 318-19 text and decide
whether the reference calculation should be revised.
