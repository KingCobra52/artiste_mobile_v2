import { expect, test, type Page } from "@playwright/test";

// These tests create accounts only in the isolated stack prepared by auth_flow_checks.
test.skip(
  process.env.PLAYWRIGHT_AUTH_FLOW_TESTS !== "1",
  "Requires isolated local auth fixtures",
);

async function login(page: Page, next = "/market") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page.getByRole("button", { name: "Existing email account" }).click();
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.PLAYWRIGHT_TEST_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.PLAYWRIGHT_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

test("onboarding hands a completed account to account choice and keeps replay sequential", async ({
  page,
}) => {
  await login(page);
  await page.goto("/onboarding?next=%2Fportfolio");
  await expect(page.getByText("1 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("2 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("3 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose your account" }),
  ).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: /^Continue as/ }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  await page.goto("/onboarding?replay=1");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.goto("/auth/continue");
  await expect(page).toHaveURL(/\/market$/);
});

test("switching accounts clears browser progress and preserves the destination", async ({
  page,
  browser,
  baseURL,
}) => {
  const otherSession = await browser.newContext({ baseURL });
  const otherPage = await otherSession.newPage();
  await login(otherPage);
  await login(page);
  await page.goto("/signup?next=%2Fportfolio");
  await page.evaluate(() =>
    localStorage.setItem(
      "artiste:onboarding:v1",
      JSON.stringify({ version: 1, step: 2, completed: true }),
    ),
  );
  await page
    .getByRole("button", { name: "Sign in with another account" })
    .click();
  await expect(page).toHaveURL(/\/login\?next=%2Fportfolio$/);
  expect(
    await page.evaluate(() => localStorage.getItem("artiste:onboarding:v1")),
  ).toBeNull();
  await page.goto("/portfolio");
  await expect(page).toHaveURL(/\/onboarding/);
  await otherPage.goto("/portfolio");
  await expect(otherPage).toHaveURL(/\/portfolio$/);
  await otherSession.close();
  await login(page);
  await page.goto("/signup?next=%2Fportfolio");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/signup\?next=%2Fportfolio$/);
});

test("handoff failures offer Retry without entering the app", async ({
  page,
}) => {
  await login(page);
  await page.route("**/auth/continue*", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.goto("/auth/continue?next=%2Fportfolio");
  await expect(
    page.getByRole("alert").filter({ hasText: "try again" }),
  ).toContainText("try again");
  await expect(page).toHaveURL(/\/auth\/continue/);
  await page.unroute("**/auth/continue*");
  await page.getByRole("button", { name: "Retry" }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
});

test("phone signup verifies OTP and consumes anonymous onboarding without replay", async ({
  page,
  browserName,
}) => {
  const phone = browserName === "webkit" ? "2025550192" : "2025550191";
  await page.goto("/onboarding?next=%2Fportfolio");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Get started" }).click();
  await page.getByLabel("Phone number").fill(phone);
  await page
    .getByLabel("Password", { exact: true })
    .fill("Local-auth-test-only-123");
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(page.getByLabel("SMS verification code")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Resend code in/ }),
  ).toBeDisabled();
  const protectedPage = await page.context().newPage();
  await protectedPage.goto("/market");
  await expect(protectedPage).toHaveURL(/\/onboarding/);
  await protectedPage.close();
  await page.getByLabel("SMS verification code").fill("000000");
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "incorrect" }),
  ).toContainText("incorrect, expired or already used");
  await expect(page).toHaveURL(/\/signup/);
  await page.getByLabel("SMS verification code").fill("123456");
  await page.getByRole("button", { name: "Verify phone", exact: true }).click();
  await expect(page).toHaveURL(/\/portfolio$/);
  expect(
    await page.evaluate(() => localStorage.getItem("artiste:onboarding:v1")),
  ).toBeNull();
  await page.reload();
  await expect(page).toHaveURL(/\/portfolio$/);
  await page.goto("/auth/continue?next=%2Fportfolio");
  await expect(page).toHaveURL(/\/portfolio$/);
});

test("failed account switching stays retryable on the account choice screen", async ({
  page,
}) => {
  await login(page);
  await page.goto("/signup?next=%2Fportfolio");
  await page.route("**/signup*", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page
    .getByRole("button", { name: "Sign in with another account" })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "try again" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Choose your account" }),
  ).toBeVisible();
  await page.unroute("**/signup*");
  await page
    .getByRole("button", { name: "Sign in with another account" })
    .click();
  await expect(page).toHaveURL(/\/login\?next=%2Fportfolio$/);
});

test("onboarding completion save failure offers Retry before account choice", async ({
  page,
}) => {
  await login(page);
  await page.goto("/onboarding?replay=1");
  await page.route("**/onboarding*", (route) =>
    route.request().method() === "POST"
      ? route.abort("failed")
      : route.continue(),
  );
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "could not save" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/onboarding/);
  await page.unroute("**/onboarding*");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Choose your account" }),
  ).toBeVisible();
});
