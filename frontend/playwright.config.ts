import { defineConfig, devices } from "@playwright/test";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const port = new URL(baseURL).port || "3000";

const authFile = "test-results/.auth/user.json";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  outputDir: "test-results/artifacts",
  use: {
    baseURL,
    ...devices["iPhone 13"],
    browserName: "chromium",
    trace: "on-first-retry",
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    {
      name: "public-phone",
      testMatch: /(?:public|auth-handoff)\.spec\.ts/,
      use: { storageState: { cookies: [], origins: [] } },
    },
    {
      name: "authenticated-phone",
      testMatch: /app\.spec\.ts/,
      dependencies: ["setup"],
      use: { storageState: authFile },
    },
    {
      name: "public-webkit-phone",
      testMatch: /(?:public|auth-handoff)\.spec\.ts/,
      use: {
        browserName: "webkit",
        storageState: { cookies: [], origins: [] },
      },
    },
    {
      name: "authenticated-webkit-phone",
      testMatch: /app\.spec\.ts/,
      dependencies: ["setup"],
      use: { browserName: "webkit", storageState: authFile },
    },
  ],
  webServer: {
    command: `npm run build -- --webpack && npm run start -- --hostname localhost --port ${port}`,
    url: `${baseURL}/login`,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});

export { authFile };
