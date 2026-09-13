import { expect, test } from "@playwright/test";

test("login renders for invited users", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByText("Invite-only beta")).toBeVisible();
});

test("unauthenticated visitors are redirected from product routes", async ({ page }) => {
  await page.goto("/market");
  await expect(page).toHaveURL(/\/login\?next=%2Fmarket$/);

  await page.goto("/portfolio");
  await expect(page).toHaveURL(/\/login\?next=%2Fportfolio$/);

  await page.goto("/artists/sza");
  await expect(page).toHaveURL(/\/login\?next=%2Fartists%2Fsza$/);
});

test("the root route sends unauthenticated visitors to login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("a failed sign in has useful feedback", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("Email").fill("not-an-invite@example.com");
  await page.getByLabel("Password").fill("incorrect-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toContainText("email or password is incorrect");
});
