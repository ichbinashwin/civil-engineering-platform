# Engineering basis — EN 1992-1-1 (Eurocode 2) two-way punching shear

Status: **Experimental** (implemented, tested against an independent calculation; not yet checked against a published
numerical example or signed off by a licensed engineer).

Source of every formula below: EN 1992-1-1:2004 §6.4, read from the standard text. Table 6.1, W1 (6.40) and the
biaxial β (6.43) were also cross-checked with a second published guide (_Concise Eurocode 2 for Bridges_, The Concrete
Centre). The ACI 318-19 module is separate and unchanged.

## Scope

Interior rectangular column, no shear reinforcement, σcp = 0, openings (circle / rectangle), uniaxial or biaxial
moments, **recommended** National Annex values. Edge / corner columns, shear reinforcement, axial stress σcp,
column bases, and a National Annex other than the recommended values are rejected or flagged.

## Units and axes

Canonical SI: N, N·mm, mm, MPa. Origin at the column centroid, c1 along X, c2 along Y. MEdx acts about the X axis
(eccentricity eZ along Y); MEdy about the Y axis (eccentricity eY along X). EC2's y axis = our X, z axis = our Y.

## Method

| Step                    | Expression                                                                                                                                               | Clause                   |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------ |
| Basic control perimeter | at 2.0d from the column, **rounded corners** radius 2d: u1 = 2(c1 + c2) + 4πd                                                                            | 6.4.2(1)                 |
| Openings                | within 6d of the column (shortest distance): the part of u1 between the two tangents from the column centre is ineffective; farther openings are ignored | 6.4.2(3)                 |
| β, no moment            | 1.0                                                                                                                                                      | 6.4.3(3)                 |
| β, one axis             | β = 1 + k (MEd/VEd)(u1/W1); k from Table 6.1 with c1 parallel to the eccentricity                                                                        | (6.39), Table 6.1        |
| W1                      | full perimeter: c1²/2 + c1c2 + 4c2d + 16d² + 2πd·c1; general: W1 = ∫\|e\| dl from the perimeter centroid axis                                            | (6.40)                   |
| β, both axes            | β = 1 + 1.8 √[(ey/bz)² + (ez/by)²], by = c1 + 4d, bz = c2 + 4d                                                                                           | (6.43)                   |
| vEd                     | β VEd / (u1 d) at u1; β VEd / (u0 d) at the column, u0 = 2(c1 + c2)                                                                                      | (6.38), 6.4.5(3)         |
| k                       | 1 + √(200/d) ≤ 2.0, d in mm                                                                                                                              | 6.4.4(1)                 |
| ρl                      | √(ρlx ρly) ≤ 0.02                                                                                                                                        | 6.4.4(1)                 |
| vRd,c                   | max[ CRd,c k (100 ρl fck)^(1/3), vmin ], CRd,c = 0.18/γc                                                                                                 | (6.47)                   |
| vmin                    | 0.035 k^(3/2) fck^(1/2)                                                                                                                                  | (6.3N)                   |
| vRd,max                 | 0.4 ν fcd, ν = 0.6 (1 − fck/250), fcd = αcc fck/γc                                                                                                       | 6.4.5(3), (6.6N), (3.15) |
| γc, αcc                 | 1.5, 1.0                                                                                                                                                 | Table 2.1N, 3.1.6(1)P    |
| Checks                  | vEd,0 ≤ vRd,max (column) and vEd ≤ vRd,c (u1); DCR = the larger ratio                                                                                    | 6.4.3(2)                 |

## Software-level choices (not clauses) — review required

1. **Table 6.1 interpolation.** The table lists c1/c2 = ≤0.5, 1.0, 2.0, ≥3.0 (k = 0.45, 0.60, 0.70, 0.80); linear
   interpolation between rows is used.
2. **β with openings.** The standard gives W1 in closed form only for the full perimeter. With openings, W1 is the
   general integral ∫|e| dl of (6.40) over the reduced perimeter measured from its centroid, and u1 is the reduced
   length. This is flagged WARNING.
3. **Biaxial β with openings.** (6.43) uses the full-perimeter dimensions and ignores openings (as also noted by
   software vendors). Flagged WARNING.
4. **One vs two moments.** (6.39) is used when only one moment is non-zero, (6.43) when both are; β therefore changes
   discontinuously when the second moment becomes non-zero (a property of the standard's two expressions).
5. **Centroid shift.** The extra moment VEd·e from the effective-section centroid offset is not added (INFO), as in
   the ACI module.
6. **ρl** must be supplied as the mean ratio over the column width plus 3d each side (§6.4.4(1)); it is not derived.
7. **National Annex.** Recommended values only. A National Annex may alter γc, αcc, CRd,c, vmin, k1, the vRd,max
   coefficient and β rules.

## Not implemented

Edge and corner columns (reduced perimeter u1*), circular columns (6.41/6.42), shear reinforcement (6.4.5), σcp /
prestress, column bases (6.4.4(2)), perimeters closer than 2d, load reduction by soil pressure.
