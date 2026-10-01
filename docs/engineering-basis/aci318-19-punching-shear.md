# Engineering basis — ACI 318-19 two-way punching shear

Status: **Experimental** (implemented, unit- and regression-tested; not yet independently verified by a licensed engineer).

## Scope

Interior rectangular column, normal-weight or lightweight concrete (λ input), no shear reinforcement,
circular and rectangular slab openings, biaxial unbalanced moments. Edge/corner columns and shear
reinforcement are rejected with an ERROR (not implemented).

## Coordinate convention

Origin at the column centroid. `c1` along X, `c2` along Y. `Mux` acts about the X axis (stress varies with y);
`Muy` acts about the Y axis (stress varies with x). Canonical units: lb, in, lb-in, psi.

## Method

| Step               | Expression                                                                                      | Provision                |
| ------------------ | ----------------------------------------------------------------------------------------------- | ------------------------ |
| Critical section   | rectangle offset d/2 from column faces; bo = 2[(c1+d)+(c2+d)]                                   | §22.6.4.1                |
| Openings           | portion of bo between straight lines from column centroid tangent to the opening is ineffective | §22.6.4.3                |
| Section properties | centroid, Ix, Iy, Jx, Jy of the _effective_ segments (see below)                                | R8.4.4.2.3 (generalized) |
| γv                 | γv = 1 − 1/(1 + (2/3)√(b1/b2)); b1 = c2+d for Mux, c1+d for Muy                                 | §8.4.2.2.2, §8.4.4.2.2   |
| Demand             | vu = Vu/(bo d) + γvx                                                                            | Mux                      |     | y−yc | /Jx + γvy | Muy |     | x−xc | /Jy, max over segment end points | §8.4.4.2 |
| λs                 | λs = √(2/(1+d/10)) ≤ 1.0                                                                        | §22.5.5.1.3              |
| vc                 | least of (a) 4λsλ√f'c, (b) (2+4/β)λsλ√f'c, (c) (2+αs d/bo)λsλ√f'c; αs = 40 interior             | Table 22.6.5.2           |
| √f'c               | ≤ 100 psi                                                                                       | §22.6.3.1                |
| φ                  | 0.75 (shear)                                                                                    | Table 21.2.1             |
| DCR                | vu,max / φvc; PASS if ≤ 1.0                                                                     | §22.6                    |

### Jx, Jy for an arbitrary effective perimeter

For straight segments of length L with end coordinates a, b relative to the centroid and unit direction (ux, uy):

```text
Ix = Σ L/3 (ya² + ya·yb + yb²)            Iy = Σ L/3 (xa² + xa·xb + xb²)
Jx = d·Ix + Σ L·d³/12 · uy²               Jy = d·Iy + Σ L·d³/12 · ux²
```

For a complete rectangle this reproduces the ACI 318-19 R8.4.4.2.3 interior-column expression
Jc = d b1³/6 + b1 d³/6 + d b2 b1²/2 exactly (unit-tested).

## Software-level choices (not code provisions) — review required

1. **Sign envelope**: moment-induced stresses use absolute values at every critical point (conservative; sign
   convention of input moments not required).
2. **Centroid shift moment**: Vu·e from the effective-section centroid offset is _not_ added; its magnitude is
   reported as INFO (cf. ACI 421.1R).
3. **Openings beyond 4h**: reduction is applied conservatively (column-strip location is unknown); INFO raised.
4. **Proximity flag**: openings within 0.5d of the critical perimeter raise a WARNING (review threshold only).
5. **γv** uses the gross critical-section dimensions b1, b2.
6. **λs option**: `options.applySizeEffectFactor = false` omits λs to reproduce legacy working calculations.
   Results then carry a non-conformance WARNING. Default is `true`.

## Not implemented

Edge/corner columns, shear reinforcement (stirrups, studs), §8.4.2.2.4 γf modification, non-rectangular
columns, lightweight concrete λ derivation from density, column-strip determination for openings.
