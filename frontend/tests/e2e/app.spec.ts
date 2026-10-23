import { expect, test } from "@playwright/test";

test("the Market renders live artist data with phone navigation", async ({ page }) => {
  await page.goto("/market");
  await expect(page.getByRole("heading", { name: "Find your next artist" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Primary navigation" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Market" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Drake", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Unavailable · No quote yet")).toHaveCount(0);
});

test("Market search matches names and symbols, clears, and shows empty results", async ({ page }) => {
  await page.goto("/market");
  const search = page.getByRole("searchbox", { name: "Search artists by name or symbol" });
  const count = page.locator("p[aria-live='polite']");
  const originalCount = await count.textContent();

  await search.fill("  dRaKe  ");
  await expect(page.getByRole("link", { name: /Drake/ })).toBeVisible();
  await expect(count).toHaveText("1 artist");

  await search.fill(" D ");
  await expect(page.getByRole("link", { name: /Drake/ })).toBeVisible();
  await expect(count).not.toHaveText("0 artists");

  await search.fill("no matching artist");
  await expect(page.getByText("No artists found")).toBeVisible();
  await expect(count).toHaveText("0 artists");

  await page.getByRole("button", { name: "Clear artist search" }).click();
  await expect(search).toHaveValue("");
  await expect(count).toHaveText(originalCount ?? "");
  await expect(page.getByRole("link", { name: /Drake/ })).toBeVisible();
});

test("an artist page shows a quote and validates whole-share orders", async ({ page }) => {
  await page.goto("/market");
  await page.getByRole("link", { name: /Drake/ }).click();
  await expect(page).toHaveURL(/\/artists\/1$/);
  await expect(page.getByRole("heading", { name: "Trade D" })).toBeVisible();

  await page.getByLabel("Number of shares").fill("1.5");
  await expect(page.getByText("Enter a positive whole number of shares.")).toBeVisible();
  await page.getByLabel("Number of shares").fill("0");
  await expect(page.getByText("Enter a positive whole number of shares.")).toBeVisible();
});

test("Portfolio shows live balances and trade history", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Your music portfolio", exact: true })).toBeVisible();
  await expect(page.getByText("Cash", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Recent trades" })).toBeVisible();
});

test("the authenticated session survives a reload", async ({ page }) => {
  await page.goto("/market");
  await page.reload();
  await expect(page).toHaveURL(/\/market$/);
  await expect(page.getByRole("heading", { name: "Find your next artist" })).toBeVisible();
});

test("unknown artists and the removed trade route return not found", async ({ page }) => {
  await page.goto("/artists/999999");
  await expect(page.getByRole("heading", { name: "Artist not found" })).toBeVisible();

  const response = await page.goto("/trade");
  expect(response?.status()).toBe(404);
});

test("users can sign out", async ({ page }) => {
  await page.goto("/market");
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("price history supports keyboard date inspection", async ({ page }) => {
  await page.goto("/artists/1");
  const slider = page.getByRole("slider", { name: "Price history chart" });
  await expect(slider).toBeVisible();
  await slider.focus();
  await slider.press("Home");
  await expect(slider).toHaveAttribute("aria-valuenow", "0");
  const first = await slider.getAttribute("aria-valuetext");
  await slider.press("ArrowRight");
  await expect(slider).toHaveAttribute("aria-valuenow", "1");
  expect(await slider.getAttribute("aria-valuetext")).not.toBe(first);
  await slider.locator("svg").hover();
  await expect(page.locator('input[type="range"]')).toHaveCount(0);
  await expect(page.getByText("Virtual share price (USD/share)", { exact: true })).toBeVisible();
  await slider.locator("svg").tap();
  await expect(slider).not.toHaveAttribute("aria-valuetext", first!);
});

test("portfolio history explains its observation coverage", async ({ page }) => {
  await page.goto("/portfolio");
  await expect(page.getByRole("heading", { name: "Portfolio history" })).toBeVisible();
  await expect(page.getByText(/Current valuation only/)).toBeVisible();
  await expect(page.getByText(/One observation/)).toBeVisible();
});
