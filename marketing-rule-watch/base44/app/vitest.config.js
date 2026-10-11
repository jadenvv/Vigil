// Vitest runs without the base44 vite plugin: tests mock @/api/base44Client and
// @/lib/app-params instead of injecting real app credentials.
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "jsdom",
    env: {
      // Lets clerkEnabled be true so auth-gated paths are exercised; no real key needed.
      VITE_CLERK_PUBLISHABLE_KEY: "pk_test_placeholder_for_tests",
    },
  },
});
