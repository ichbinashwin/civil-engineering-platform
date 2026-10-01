# Formula audit — ACI 318-19 two-way punching shear (engine 0.3.0)

Date: 2026-10-01. Scope: every formula in `packages/engineering-core/src/punching` and `geometry`.

## Benchmarks used

| Benchmark                                                                                             | Source                                                                                                                                       | Result                                               |
| ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- |
| CSI Software Verification, Example ACI 318-14 RC-PN-001 (= ACI 318-08 RC-PN-001), interior column B-2 | [docs.csiamerica.com](https://docs.csiamerica.com/manuals/safe/Verification/Design%20Verification/ACI%20318-08/ACI%20318-08%20RC-PN-001.pdf) | **Exact match** (see below)                          |
| ACI 318-19 RC-PN Example 002 (Scribd 755179950)                                                       | Scribd — text not accessible without login                                                                                                   | **Not checked** — needs the PDF pages                |
| Brute-force numerical integration (independent code, no engine geometry reused)                       | `tests/unit/independent-checks.test.ts`                                                                                                      | Match for bo, x̄, ȳ, Ix, Iy, Ixy in 4 opening layouts |
| Project reference case (working calc)                                                                 | supplied brief                                                                                                                               | bo exact; vu 166.8 vs ≈165 psi; λs omitted in source |

### CSI RC-PN-001 comparison (`tests/regression/csi-rc-pn-001.test.ts`)

Column 12 × 36 in, h = 10 in, d = 8.5 in, f'c = 4000 psi, Vu = 189.45 k, γv2Mu2 = −156.39 k-in, γv3Mu3 = 91.538 k-in.

| Quantity      | CSI hand calc             | Engine                       |
| ------------- | ------------------------- | ---------------------------- |
| bo            | 130 in                    | 130.000 in                   |
| γv2 / γv3     | 0.4955 / 0.3115           | 0.4955 / 0.3115              |
| Centroid      | (0, 0)                    | (0, 0)                       |
| IXX (= Jx)    | 301 922.3 in⁴             | 301 922.3 in⁴                |
| IYY (= Jy)    | 93 782.8 in⁴              | 93 782.8 in⁴                 |
| Vu/(bo d)     | 0.1714 ksi                | 0.1714 ksi                   |
| Moment terms  | 0.0115 + 0.0100 ksi       | 0.0115 + 0.0100 ksi          |
| vu,max        | 0.1930 ksi                | 0.1930 ksi                   |
| φvc (governs) | 0.158 ksi, Eq. (b), β = 3 | 0.158 ksi, Table 22.6.5.2(b) |
| φvc (a) / (c) | 0.190 / 0.219 ksi         | 0.190 / 0.219 ksi            |
| Ratio         | 1.22                      | 1.22 FAIL                    |

ACI 318-19 differs from 318-14 here only by λs; d = 8.5 in < 10 in gives λs = 1, so the 318-19 answer is identical.

## Formula-by-formula

| #   | Formula                                                                                                | Provision                  | Status                                                   |
| --- | ------------------------------------------------------------------------------------------------------ | -------------------------- | -------------------------------------------------------- |
| 1   | Critical section at d/2: b1 = c1 + d, b2 = c2 + d, bo = 2(b1 + b2)                                     | §22.6.4.1                  | ✔ CSI + brute force                                      |
| 2   | Opening: bo between tangent lines from column centroid is ineffective                                  | §22.6.4.3                  | ✔ brute force (circle + rectangle, overlap, corner wrap) |
| 3   | Centroid of effective section x̄, ȳ = Σ L·xm / Σ L                                                      | R8.4.4.2.3                 | ✔ CSI + brute force                                      |
| 4   | Jx = d·Σ L/3(ya²+ya·yb+yb²) + Σ L d³/12·uy² (and Jy)                                                   | R8.4.4.2.3                 | ✔ = CSI IXX/IYY; = ACI Jc for rectangle                  |
| 5   | **Jxy = d·Σ L/6(2xa·ya + xa·yb + xb·ya + 2xb·yb)**                                                     | §8.4.4.2 (general biaxial) | **Added in 0.3.0** — was missing                         |
| 6   | γf = 1/(1 + ⅔√(b1/b2)), γv = 1 − γf; b1 in direction of span of the moment                             | §8.4.2.2.2, §8.4.4.2.2     | ✔ CSI                                                    |
| 7   | vu = Vu/(bo d) + γvx·Mux[Jy(y−ȳ) − Jxy(x−x̄)]/(JxJy − Jxy²) + γvy·Muy[Jx(x−x̄) − Jxy(y−ȳ)]/(JxJy − Jxy²) | §8.4.4.2                   | ✔ CSI (reduces to γvMc/Jc when Jxy = 0)                  |
| 8   | λs = √(2/(1 + d/10)) ≤ 1                                                                               | §22.5.5.1.3                | ✔ unit test                                              |
| 9   | √f'c ≤ 100 psi                                                                                         | §22.6.3.1                  | ✔ unit test                                              |
| 10  | vc = min[(a) 4, (b) 2 + 4/β, (c) 2 + αs·d/bo] × λs·λ·√f'c; αs = 40/30/20                               | Table 22.6.5.2             | ✔ CSI (a), (b), (c)                                      |
| 11  | φ = 0.75                                                                                               | Table 21.2.1               | ✔ CSI                                                    |
| 12  | DCR = vu,max/φvc, PASS if ≤ 1                                                                          | §22.6                      | ✔ CSI                                                    |
| 13  | Units: kip→lb ×1000, kip-ft→lb-in ×12 000                                                              | —                          | ✔ unit test                                              |

## Defects found and fixed

1. **Missing product-of-inertia term (Jxy).** With asymmetric openings the principal axes rotate. CSI SAFE/ETABS and
   ACI 421.1R use the general biaxial formula (row 7). Engine ≤ 0.2.0 assumed Jxy = 0. Impact on the reference case:
   vu,max 166.55 → 166.75 psi (+0.1 %), DCR 0.895 → 0.896. Larger for big or eccentric openings.
2. **No signed-moment option.** Added `momentSignConvention: "signed"`. Default stays "envelope" (each moment term
   taken with its worst sign, conservative). For a symmetric section the envelope equals the worst case of the signed
   result, so CSI's 0.1930 ksi is reproduced in both modes.

## Known differences to check with the engineer

- **λs (size effect).** ACI 318-19 applies λs to two-way shear. For d > 10 in it reduces vc (d = 16 in → 0.877).
  Legacy (318-14) calculations and the project reference omit it. The UI checkbox _Apply size-effect factor λs_ must
  stay **ticked** for ACI 318-19.
- **Moments about the shifted centroid (Vu·e).** With openings, the effective-section centroid moves. The engine
  reports Vu·e as INFO but does not add it. CSI's interior-column verification has e = 0, so this was not tested.
- **d.** Enter the average effective depth of both directions (CSI: d = [(h − 1) + (h − 2)]/2).
- **Circular columns, edge and corner columns, shear reinforcement:** not implemented. A circular column modelled as a
  square gives a different bo (π(D + d) vs 4(D + d)).
- **Sign convention vs CSI output.** In signed mode positive Mux raises stress on the +y side. CSI writes
  vu = V/(bo d) − γv2Mu2(…) − γv3Mu3(…), so enter Mux = −Mu2 and Muy = −Mu3 for a like-for-like signed comparison.
