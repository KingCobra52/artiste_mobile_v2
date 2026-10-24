import { expect, test } from "@playwright/test";
const browserErrors = new WeakMap<object, string[]>();
test.beforeEach(async ({ page, browserName }) => {
  const errors: string[] = [];
  browserErrors.set(page, errors);
  page.on("pageerror", (error) => {
    // WebKit reports cancelled same-origin RSC prefetches during document
    // replacement as access-control page errors. Keep all other errors fatal.
    // https://github.com/microsoft/playwright/issues/43120
    if (
      browserName === "webkit" &&
      error.message.includes("127.0.0.1:3000/") &&
      error.message.includes("_rsc=") &&
      error.message.endsWith("due to access control checks.")
    )
      return;
    errors.push(error.message);
  });
});
test.afterEach(async ({ page }) => {
  expect(
    browserErrors.get(page),
    "browser runtime and hydration errors",
  ).toEqual([]);
});
test("Market shows only supported artists and search works", async ({
  page,
}) => {
  await page.goto("/market");
  await expect(
    page.getByRole("heading", { name: "Find your next artist" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Kendrick Lamar/ }),
  ).toBeVisible();
  const search = page.getByRole("searchbox");
  await search.fill("  kEnDrIcK  ");
  await expect(page.locator("p[aria-live='polite']")).toHaveText("1 artist");
  await search.fill("no artist matches");
  await expect(page.getByText("No artists found")).toBeVisible();
  await page.getByRole("button", { name: "Clear artist search" }).click();
  await expect(
    page.getByRole("link", { name: /Kendrick Lamar/ }),
  ).toBeVisible();
});
test("artist context and trading information follow the research journey", async ({
  page,
}) => {
  await page.goto("/artists/4");
  await expect(
    page.getByRole("heading", { name: "Kendrick Lamar", exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/rapper from Compton/)).toBeVisible();
  await expect(
    page.getByRole("link", { name: /Listen on the official channel/ }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: /Trade KL/ })).toBeVisible();
  await page.getByLabel("Number of shares").fill("1.5");
  await expect(
    page.getByText("Enter a positive whole number of shares."),
  ).toBeVisible();
  await page.getByLabel("Number of shares").fill("1");
  await page
    .getByRole("button", { name: "Review estimate", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Review your paper trade" }),
  ).toBeVisible();
  await expect(page.getByText("Fee (0.10%)", { exact: true })).toBeVisible();
});
test("portfolio shows account value and per-holding timestamps", async ({
  page,
}) => {
  await page.goto("/portfolio");
  await expect(
    page.getByRole("heading", { name: "Your music portfolio" }),
  ).toBeVisible();
  await expect(
    page.getByText("Total account value", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Total account performance" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your holdings" }),
  ).toBeVisible();
  await expect(
    page
      .getByText("Valued at purchase cost—current quote unavailable.", {
        exact: true,
      })
      .first(),
  ).toBeVisible();
});
test("charts support keyboard and touch inspection", async ({ page }) => {
  await page.goto("/artists/4");
  const chart = page.getByRole("slider", { name: "Price history chart" });
  await expect(chart).toBeVisible();
  await chart.focus();
  await chart.press("Home");
  await expect(chart).toHaveAttribute("aria-valuenow", "0");
  await chart.press("End");
  await chart.locator("svg").tap();
  await expect(chart).toHaveAttribute("aria-valuetext", /share/);
});
test("account session survives reload and onboarding can be replayed", async ({
  page,
}) => {
  await page.goto("/market");
  await page.reload();
  await expect(page).toHaveURL(/\/market$/);
  await page
    .getByRole("link", { name: "How Artiste works", exact: true })
    .click();
  await expect(page.getByText("1 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page).toHaveURL(/\/market$/);
});
test("product routes fit phone, tablet and desktop", async ({ page }) => {
  test.setTimeout(90_000);
  for (const width of [360, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of ["/market", "/artists/4", "/portfolio", "/account"]) {
      await page.goto(path);
      const titles: Record<string, string> = {
        "/market": "Find your next artist",
        "/artists/4": "Kendrick Lamar",
        "/portfolio": "Your music portfolio",
        "/account": "Your account",
      };
      await expect(
        page.getByRole("heading", { name: titles[path], exact: true }),
      ).toBeVisible();
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});
test("unknown artists have a useful not-found state", async ({ page }) => {
  await page.goto("/artists/999999");
  await expect(
    page.getByRole("heading", { name: "Artist not found" }),
  ).toBeVisible();
});
