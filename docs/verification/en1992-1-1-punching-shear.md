# Verification — EN 1992-1-1 punching shear (engine 0.4.0)

Date: 2026-10-01. Status: **Experimental**.

## What was checked

| Check                               | Method                                                                                                                                                                                                                    | Result                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Formulas, constants, clause numbers | Read from the text of EN 1992-1-1:2004 (§2.4.2.4 Table 2.1N, §3.1.6, §6.2.2 (6.6N), §6.4.2–6.4.5); Table 6.1, (6.40), (6.43) cross-checked with _Concise Eurocode 2 for Bridges_ (The Concrete Centre)                    | Match                                                     |
| W1 of the full control perimeter    | Engine integral of ∫\|e\| dl over arcs and lines vs closed form (6.40), both axes, square and rectangular columns                                                                                                         | Agree to 1e-5                                             |
| Whole calculation                   | `tests/regression/ec2_reference.py`: independent implementation (formulas written from the standard, perimeter integrated by sampling at 40 points/mm, ray-shadow test for openings). 9 cases                             | Engine agrees: closed-form cases 1e-6, opening cases 2e-4 |
| Cases covered                       | one axis; both axes (6.43); concentric; d > 200 mm (k uncapped); vmin governing; column-perimeter check governing; circular / rectangular openings; opening beyond 6d ignored; overlapping shadows                        | all pass                                                  |
| ACI 318-19 unchanged                | The ACI source files are byte-identical to the previous commit; `tests/regression/aci-unchanged.test.ts` compares complete ACI results of 7 inputs with a golden snapshot (also run against the previous commit's engine) | identical except `meta.engineVersion`                     |
| Speed                               | 300-run average in `tests/unit/performance.test.ts` (budgets 3 ms / 6 ms)                                                                                                                                                 | ACI ≈ 0.06 ms, EN 1992-1-1 ≈ 0.4 ms per calculation       |

## Not found

No published **numerical** worked example for an interior rectangular column with these inputs was available in
the free sources searched (the ACI 318-19 RC-PN Scribd example is behind a login; EC2 calculators and articles
show formulas but no solved numbers). Until a published example (for instance from a national EC2 worked-example
collection) is reproduced, the module stays Experimental. To close this: add the example to
`tests/regression/ec2-reference.test.ts` and record the comparison here.

## Engineer actions

1. Confirm the National Annex values for the project country (recommended values are used).
2. Confirm that ρl is the mean over the column width + 3d each side.
3. Review the WARNINGs raised for openings (W1 generalized; (6.43) ignores openings).
