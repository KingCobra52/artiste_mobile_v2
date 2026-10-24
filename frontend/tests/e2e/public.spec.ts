import { expect, test } from "@playwright/test";
test("onboarding has three screens, resumes and can be skipped", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByText("1 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("2 of 3", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("2 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await expect(page.getByText("3 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByText("2 of 3", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Skip", exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
});
test("phone signup and password recovery use accessible phone inputs", async ({
  page,
}) => {
  await page.goto("/signup");
  await expect(
    page.getByRole("heading", { name: "Create your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Phone number")).toHaveAttribute("type", "tel");
  await expect(page.getByLabel("Password", { exact: true })).toHaveAttribute(
    "minlength",
    "8",
  );
  await page.goto("/login");
  await page.getByRole("link", { name: "Forgot password?" }).click();
  await expect(
    page.getByRole("heading", { name: "Recover your account" }),
  ).toBeVisible();
  await expect(page.getByLabel("Phone number")).toBeVisible();
  await page.getByRole("button", { name: "Existing email account" }).click();
  await expect(page.getByLabel("Email", { exact: true })).toBeVisible();
});
test("protected routes preserve the intended destination", async ({ page }) => {
  for (const path of [
    "/market",
    "/portfolio",
    "/artists/4",
    "/account",
    "/artists/4?tab=music",
  ]) {
    await page.goto(path);
    await expect(page).toHaveURL(
      new RegExp(`/login\\?next=${encodeURIComponent(path)}$`),
    );
  }
});
test("auth pages fit small phones without horizontal overflow", async ({
  page,
}) => {
  test.setTimeout(90_000);
  for (const width of [360, 390, 430, 768, 1280]) {
    await page.setViewportSize({ width, height: 844 });
    for (const path of [
      "/onboarding?replay=1",
      "/login",
      "/signup",
      "/recover",
    ]) {
      await page.goto(path);
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    }
  }
});

test("interrupted signup keeps form progress and prevents duplicate submission", async ({
  page,
}) => {
  await page.goto("/signup");
  await page.getByLabel("Phone number").fill("2125550100");
  await page
    .getByLabel("Password", { exact: true })
    .fill("local-test-password");
  await page.route("**/signup", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    await new Promise((resolve) => setTimeout(resolve, 800));
    return route.abort("failed");
  });
  await page
    .getByRole("button", { name: "Create account", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Please wait…", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("alert").filter({ hasText: "Please try again" }),
  ).toBeVisible();
  await expect(page.getByLabel("Phone number")).toHaveValue("2125550100");
  await expect(page.getByLabel("Password", { exact: true })).toHaveValue(
    "local-test-password",
  );
  await expect(
    page.getByRole("button", { name: "Create account", exact: true }),
  ).toBeEnabled();
});
