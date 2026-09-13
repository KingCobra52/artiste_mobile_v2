import { expect, test } from "@playwright/test";

test("the Market renders with phone navigation", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: "Find your next artist" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Market" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("SZA", { exact: true }).first()).toBeVisible();
});

test("an artist page contains the inline trade flow", async ({ page }) => {
  await page.goto("/market");
  await page.getByRole("link", { name: /SZA/ }).click();
  await expect(page).toHaveURL(/\/artists\/sza$/);
  await expect(page.getByRole("heading", { name: "Trade SZA" })).toBeVisible();

  await page.getByLabel("Number of shares").fill("1.5");
  await expect(page.getByText("Enter a positive whole number of shares.")).toBeVisible();
  await page.getByLabel("Number of shares").fill("2");
  await page.getByRole("button", { name: "Buy SZA" }).click();
  await expect(page.getByRole("status")).toContainText("Trading is not connected yet");

  await page.goto("/artists/tyler-the-creator");
  await expect(page.getByText(/quote is stale/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Buy TYLR" })).toBeDisabled();
});

test("Portfolio shows typed value and allocation placeholders", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Portfolio" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Value history" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Allocation" })).toBeVisible();
  await expect(page.getByText("Chart coming later")).toHaveCount(2);
});

test("the authenticated session survives a reload", async ({ page }) => {
  await page.goto("/market");
  await page.reload();
  await expect(page).toHaveURL(/\/market$/);
  await expect(page.getByRole("heading", { name: "Find your next artist" })).toBeVisible();
});

test("unknown artists and the removed trade route return not found", async ({ page }) => {
  await page.goto("/artists/not-in-market");
  await expect(page.getByRole("heading", { name: "Artist not found" })).toBeVisible();

  const response = await page.goto("/trade");
  expect(response?.status()).toBe(404);
});

test("users can sign out", async ({ page }) => {
  await page.goto("/market");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});
