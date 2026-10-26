import { expectAccessible } from "./accessibility";
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
  await expect(page).toHaveURL(/\/signup/);
});
test("Get started opens sign up with the intended destination", async ({
  page,
}) => {
  await page.goto("/onboarding?next=%2Fartists%2F4%3Ftab%3Dmusic");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Get started" }).click();
  await expect(page).toHaveURL(
    /\/signup\?next=%2Fartists%2F4%3Ftab%3Dmusic$/,
  );
  await expect(page.getByRole("heading", { name: "Create your account" })).toBeVisible();
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
      new RegExp(`/onboarding\\?next=${encodeURIComponent(path)}$`),
    );
    await expect(page.getByRole("navigation", { name: "Primary navigation" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Market", exact: true })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Portfolio", exact: true })).toHaveCount(0);
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

for (const appearance of ["light", "dark"] as const) {
  test(`${appearance} onboarding and authentication are accessible`, async ({
    page,
  }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({
      colorScheme: appearance,
      reducedMotion: "reduce",
    });
    for (const path of [
      "/onboarding?replay=1",
      "/login",
      "/signup",
      "/recover",
    ]) {
      await page.goto(path);
      await expect(page.locator("h1")).toBeVisible();
      await expectAccessible(page);
    }
  });
}

test("authentication remains usable with enlarged phone text", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 640 });
  for (const path of [
    "/onboarding?replay=1",
    "/login",
    "/signup",
    "/recover",
  ]) {
    await page.goto(path);
    await expect(page.locator("h1")).toBeVisible();
    await page.addStyleTag({ content: "html { font-size: 200% !important; }" });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
        ),
    );
    const geometry = await page.evaluate(() => ({
      width: innerWidth,
      scroll: document.documentElement.scrollWidth,
      overflow: Array.from(document.querySelectorAll("main *"))
        .map((element) => ({
          tag: element.tagName,
          className: element.getAttribute("class"),
          right: element.getBoundingClientRect().right,
        }))
        .filter((element) => element.right > innerWidth + 1)
        .slice(0, 6),
    }));
    expect(
      geometry.scroll,
      `${path}: ${JSON.stringify(geometry)}`,
    ).toBeLessThanOrEqual(geometry.width);
  }
});
