# @civil/engineering-excel

Formatted Excel export (ExcelJS) of engine results. Sheets: Summary, Inputs, Geometry, Punching calculation,
Capacity, Audit.

- The engine is authoritative. Calculation sheets show **Excel formula** (live, yellow), **Engine value** and
  **Δ** side by side; formulas cache the engine value and Excel recalculates on open.
- Tangent-line geometry and effective-section properties are engine values (labeled), not worksheet formulas.
- User text is always written as string cells, control characters removed, formula triggers neutralized.
- `tests/unit/excel-export.test.ts` evaluates every formula and checks it reproduces the engine.
