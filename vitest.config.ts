import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/{unit,integration,regression}/**/*.test.ts"],
    environment: "node",
    passWithNoTests: false,
  },
});
