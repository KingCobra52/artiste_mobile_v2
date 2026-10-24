import { expect, test as setup } from "@playwright/test";
import { authFile } from "../../playwright.config";

setup("sign in with the dedicated test account", async ({ page }) => {
  const email = process.env.PLAYWRIGHT_TEST_EMAIL;
  const password = process.env.PLAYWRIGHT_TEST_PASSWORD;

  if (!email || !password) {
    throw new Error(
      "Set PLAYWRIGHT_TEST_EMAIL and PLAYWRIGHT_TEST_PASSWORD for a dedicated Supabase test account.",
    );
  }

  await page.goto("/login");
  await page.getByRole("button", { name: "Existing email account" }).click();
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  // Completed accounts can pass through /onboarding before its server redirect.
  await Promise.race([
    page.waitForURL(/\/market$/),
    skip.waitFor({ state: "visible" }),
  ]);
  if (await skip.isVisible()) await skip.click();
  await expect(page).toHaveURL(/\/market$/);
  await page.context().storageState({ path: authFile });
});
