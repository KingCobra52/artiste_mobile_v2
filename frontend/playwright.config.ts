import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const authFile = "test-results/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results/artifacts",
  use: {
    baseURL: "http://127.0.0.1:3000",
    ...devices["iPhone 13"],
    browserName: "chromium",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public-phone",
      testMatch: /public\.spec\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: "authenticated-phone",
      testMatch: /app\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: authFile },
    },
  ],
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3000",
    url: "http://127.0.0.1:3000/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

export { authFile };
