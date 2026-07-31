import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,
    // Ficheiros de integração partilham a mesma base de dados: corrê-los em
    // paralelo faria uns apagarem os dados dos outros a meio.
    fileParallelism: false,
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      exclude: ["src/index.ts", "src/types/**"],
    },
  },
});
