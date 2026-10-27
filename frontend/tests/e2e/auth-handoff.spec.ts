import { expect, test, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";

// These tests create accounts only in the isolated stack prepared by auth_flow_checks.
test.skip(
  process.env.PLAYWRIGHT_AUTH_FLOW_TESTS !== "1",
  "Requires isolated local auth fixtures",
);

async function login(page: Page, next = "/market") {
  await page.goto(`/login?next=${encodeURIComponent(next)}`);
  await page
    .getByLabel("Email", { exact: true })
    .fill(process.env.PLAYWRIGHT_TEST_EMAIL!);
  await page
    .getByLabel("Password", { exact: true })
    .fill(process.env.PLAYWRIGHT_TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

async function waitForEmailLink(email: string, subject: string) {
  const mailpit = process.env.PLAYWRIGHT_MAILPIT_URL;
  if (!mailpit) throw new Error("PLAYWRIGHT_MAILPIT_URL is required.");
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const searchUrl = new URL("/api/v1/search", mailpit);
    searchUrl.searchParams.set("query", `to:${email}`);
    searchUrl.searchParams.set("limit", "20");
    const response = await fetch(searchUrl);
    if (response.ok) {
      const result = (await response.json()) as {
        messages?: Array<{ ID: string; Subject: string }>;
      };
      const message = result.messages?.find((item) =>
        item.Subject.toLowerCase().includes(subject.toLowerCase()),
      );
      if (message) {
        const detailsResponse = await fetch(
          new URL(`/api/v1/message/${message.ID}`, mailpit),
        );
        if (detailsResponse.ok) {
          const details = (await detailsResponse.json()) as {
            HTML?: string;
            Text?: string;
          };
          const content = `${details.HTML ?? ""}\n${details.Text ?? ""}`;
          const links = [...content.matchAll(/https?:\/\/[^\s"'<>]+/g)].map(
            (match) => match[0].replaceAll("&amp;", "&"),
          );
          const link = links.find((value) => value.includes("/auth/v1/verify"));
          if (link) return link;
        }
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`No ${subject} email arrived for the test account.`);
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

test("email signup verification and password recovery preserve onboarding", async ({
  page,
}) => {
  const email = `auth-${randomUUID()}@example.test`;
  const initialPassword = "Local-auth-test-only-123";
  const recoveredPassword = "Local-auth-recovered-456";
  await page.goto("/signup?next=%2Fportfolio");
  await page.evaluate(() =>
    localStorage.setItem(
      "artiste:onboarding:v1",
      JSON.stringify({ version: 1, step: 2, completed: true }),
    ),
  );
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(initialPassword);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByRole("status")).toContainText("Check your email");
  await expect(page.getByRole("button", { name: "Resend verification" })).toBeDisabled();

  await page.goto(await waitForEmailLink(email, "confirm"));
  await expect(page).toHaveURL(/\/portfolio$/);
  expect(
    await page.evaluate(() => localStorage.getItem("artiste:onboarding:v1")),
  ).toBeNull();

  await page.goto("/recover");
  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("status")).toContainText("If an account exists");
  await page.goto(await waitForEmailLink(email, "reset password"));
  await expect(page).toHaveURL(/\/reset-password$/);
  await page.getByLabel("New password").fill(recoveredPassword);
  await page.getByRole("button", { name: "Set new password" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1$/);

  await page.getByLabel("Email", { exact: true }).fill(email);
  await page.getByLabel("Password", { exact: true }).fill(recoveredPassword);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
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
