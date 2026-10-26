import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /configuration\.spec\.ts/,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results/configuration-artifacts",
  use: {
    baseURL: "http://127.0.0.1:3101",
    ...devices["iPhone 13"],
    browserName: "chromium",
  },
  webServer: {
    command: "npm run dev -- --webpack --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101/login",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      ...process.env,
      ARTISTE_NEXT_DIST_DIR: ".next-config-tests",
      NEXT_PUBLIC_SUPABASE_URL: "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    },
  },
});
