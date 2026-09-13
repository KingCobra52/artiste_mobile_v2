import { expect, test } from "@playwright/test";

for (const path of ["/", "/login", "/market"]) {
  test(`missing configuration is explained at ${path}`, async ({ page }) => {
    await page.goto(path);
    await expect(page.getByRole("heading", { name: "Connect Supabase to continue" })).toBeVisible();
    await expect(page.getByText("NEXT_PUBLIC_SUPABASE_URL", { exact: true })).toBeVisible();
    await expect(page.getByText("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", { exact: true })).toBeVisible();
    await expect(page.locator("body")).not.toContainText("service_role");
    await expect(page.locator("body")).not.toContainText("at createClient");
  });
}

test("the auth callback returns to the setup screen when configuration is missing", async ({ page }) => {
  await page.goto("/auth/callback?code=unused");
  await expect(page).toHaveURL(/\/login\?error=configuration$/);
  await expect(page.getByRole("heading", { name: "Connect Supabase to continue" })).toBeVisible();
});
