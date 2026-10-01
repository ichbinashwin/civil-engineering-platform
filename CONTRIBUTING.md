# Contributing

1. Branch from `main`.
2. Keep engineering formulas in `packages/engineering-core` only. Cite the code provision for every constant
   and formula. Never invent an equation; if a provision is uncertain, stop and return a review-required result.
3. Any formula change: bump `ENGINE_VERSION`, update `docs/engineering-basis/` and `docs/verification/`,
   add or update tests.
4. Run `pnpm verify` before opening a pull request.
5. Use conventional commit messages (`feat:`, `fix:`, `docs:`, `test:`, `chore:`).
