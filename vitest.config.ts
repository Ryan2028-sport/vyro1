import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Standalone from vite.config.ts on purpose: the app build config loads the
// Cloudflare/TanStack Start plugin chain, which is irrelevant (and hostile) to
// a fast Node-based unit test run.
export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    passWithNoTests: false,
    reporters: ["default"],
    coverage: {
      reporter: ["text", "lcov"],
      include: ["src/lib/**/*.ts"],
    },
  },
});
