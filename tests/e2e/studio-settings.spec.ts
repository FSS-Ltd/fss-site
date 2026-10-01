import { expect, test } from "@playwright/test";
import { defaultActiveStudioSettings } from "../../lib/operations/studio/active-settings-types";

const initial = { ...defaultActiveStudioSettings, revision: 1 };

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/visual/fss-studio/studio-settings");
  await expect(
    page.getByRole("heading", { level: 1, name: "Studio settings" }),
  ).toBeVisible();
});

test("keyboard editor retains dirty values until explicit discard and restores focus", async ({
  page,
}, testInfo) => {
  await page.screenshot({
    path: `/private/tmp/fss-welcome-redesign/settings-summary-${testInfo.project.name}.png`,
    fullPage: true,
  });
  const edit = page.getByRole("button", { name: "Edit identity", exact: true });
  await edit.focus();
  await page.keyboard.press("Enter");
  const name = page.getByRole("textbox", { name: "Display name" });
  await expect(name).toBeFocused();
  await name.fill("Unapplied FSS name");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Discard your unapplied settings edits?",
  );
  await page.getByRole("button", { name: "Keep editing", exact: true }).click();
  await expect(name).toHaveValue("Unapplied FSS name");
  await expect(name).toBeFocused();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page
    .getByRole("button", { name: "Discard edits", exact: true })
    .click();
  await expect(name).not.toBeVisible();
  await expect(edit).toBeFocused();
  await expect(
    page.getByText("Unapplied FSS name", { exact: true }),
  ).not.toBeVisible();
});

test("failed apply retains edits, pending prevents duplicate requests, success updates cards", async ({
  page,
}) => {
  let requests = 0;
  let release: (() => void) | undefined;
  await page.route("**/api/portal/admin/settings", async (route) => {
    requests += 1;
    const input = route.request().postDataJSON();
    expect(input).toEqual({
      section: "identity",
      expectedRevision: 1,
      values: { displayName: "Applied FSS identity" },
    });
    if (requests === 1)
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    await route.fulfill({
      status: requests === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        requests === 1
          ? { error: "Temporary failure. Your edits are retained." }
          : { ...initial, displayName: input.values.displayName, revision: 2 },
      ),
    });
  });
  await page
    .getByRole("button", { name: "Edit identity", exact: true })
    .click();
  const name = page.getByRole("textbox", { name: "Display name" });
  await name.fill("Applied FSS identity");
  const save = page.getByRole("button", {
    name: "Save and apply",
    exact: false,
  });
  await save.click();
  await expect(save).toBeDisabled();
  await expect(name).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await expect.poll(() => requests).toBe(1);
  release?.();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Temporary failure",
  );
  await expect(name).toHaveValue("Applied FSS identity");
  await save.click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Settings revision 2 applied." }),
  ).toBeVisible();
  await expect(
    page.getByText("Applied FSS identity", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Edit identity", exact: true }),
  ).toBeFocused();
  expect(requests).toBe(2);
});

test("conflict keeps entered values and requires review before rebasing", async ({
  page,
}) => {
  let requests = 0;
  const current = { ...initial, responseExpectationHours: 72, revision: 5 };
  await page.route("**/api/portal/admin/settings", async (route) => {
    requests += 1;
    const input = route.request().postDataJSON();
    expect(input.section).toBe("communication");
    expect(input.values).toEqual({
      replyTo: null,
      responseExpectationHours: 24,
    });
    expect(input.expectedRevision).toBe(requests === 1 ? 1 : 5);
    await route.fulfill({
      status: requests === 1 ? 409 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        requests === 1
          ? {
              error:
                "Another administrator applied settings. Your edits are retained.",
              current,
            }
          : { ...current, responseExpectationHours: 24, revision: 6 },
      ),
    });
  });
  await page
    .getByRole("button", { name: "Edit communication", exact: true })
    .click();
  const hours = page.getByRole("spinbutton", {
    name: "Response expectation (hours)",
  });
  await hours.fill("24");
  const save = page.getByRole("button", { name: "Save and apply" });
  await save.click();
  await expect(page.locator("main").getByRole("alert")).toContainText(
    "Applied revision 5",
  );
  await expect(hours).toHaveValue("24");
  await expect(save).toBeDisabled();
  await page
    .getByRole("button", { name: "Review and use current revision" })
    .click();
  await expect(save).toBeEnabled();
  await expect(hours).toHaveValue("24");
  await save.click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Settings revision 6 applied." }),
  ).toBeVisible();
  await expect(page.getByText("24 hours", { exact: true })).toBeVisible();
});

test("unapplied edits protect page navigation", async ({ page }) => {
  await page
    .getByRole("button", { name: "Edit timezone", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Timezone" })
    .fill("America/New_York");
  const dialog = page.waitForEvent("dialog");
  const click = page
    .getByRole("link", { name: "Clients", exact: true })
    .first()
    .click();
  await (await dialog).dismiss();
  await click;
  await expect(page).toHaveURL(/studio-settings$/);
  await expect(page.getByRole("textbox", { name: "Timezone" })).toHaveValue(
    "America/New_York",
  );
});

test("dark appearance at 200 percent keeps controls visible without horizontal overflow", async ({
  page,
  context,
}, testInfo) => {
  await context.addCookies([
    {
      name: "fss-portal-appearance",
      value: "dark",
      url: "http://127.0.0.1:3210",
    },
  ]);
  await page.reload();
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
  });
  await expect(page.locator(".portal-theme")).toHaveAttribute(
    "data-appearance",
    "dark",
  );
  await page
    .getByRole("button", { name: "Edit delivery", exact: true })
    .click();
  await expect(
    page.getByRole("combobox", { name: "Delivery capacity" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Save and apply" }),
  ).toBeVisible();
  await page.screenshot({
    path: `/private/tmp/fss-welcome-redesign/settings-dark-200-${testInfo.project.name}.png`,
    fullPage: true,
  });
  const heading = await page
    .getByRole("heading", { level: 1, name: "Studio settings" })
    .boundingBox();
  expect((heading?.x ?? 0) + (heading?.width ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  const signOut = await page
    .getByRole("button", { name: "Sign out", exact: true })
    .boundingBox();
  expect(signOut).not.toBeNull();
  expect((signOut?.x ?? 0) + (signOut?.width ?? 0)).toBeLessThanOrEqual(
    page.viewportSize()?.width ?? 0,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
