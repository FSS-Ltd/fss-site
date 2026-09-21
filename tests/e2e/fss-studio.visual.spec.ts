import { expect, test, type Page } from "@playwright/test";

async function openScenario(
  page: Page,
  scenario: string,
  heading: string,
): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/visual/fss-studio/${scenario}`);
  await expect(
    page.getByRole("heading", { level: 1, name: heading }),
  ).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

test.describe("FSS Studio desktop visuals", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "fss-studio-desktop",
      "This assertion is captured at the approved desktop viewport.",
    );
    await page.setViewportSize({ width: 1440, height: 1200 });
  });

  test("client sign-in desktop matches C00", async ({ page }) => {
    await openScenario(page, "client-login", "Sign in to FSS");
    await expect(page).toHaveScreenshot("c00-client-sign-in-desktop.png");
  });

  test("client overview desktop matches C01", async ({ page }) => {
    await openScenario(page, "client-overview", "Your workspace");
    await expect(page).toHaveScreenshot("c01-client-overview-desktop.png");
  });

  test("client workspace selection desktop matches C25", async ({ page }) => {
    await openScenario(
      page,
      "client-workspace-switcher",
      "Choose your workspace",
    );
    await expect(page).toHaveScreenshot("c25-client-workspace-desktop.png");
  });

  test("client request board desktop matches C05", async ({ page }) => {
    await openScenario(page, "client-request-board", "Requests & feedback");
    await expect(page).toHaveScreenshot("c05-client-request-board-desktop.png");
  });

  test("client request creation desktop matches C06", async ({ page }) => {
    await openScenario(
      page,
      "client-request-form",
      "What would you like us to do?",
    );
    await expect(page).toHaveScreenshot("c06-client-request-form-desktop.png");
  });

  test("client bug report desktop matches C07", async ({ page }) => {
    await openScenario(page, "client-bug-report", "Report a problem");
    await expect(page).toHaveScreenshot("c07-client-bug-report-desktop.png");
  });

  test("client request review desktop matches C09", async ({ page }) => {
    await openScenario(page, "client-request-review", "Ready for your review");
    await expect(page).toHaveScreenshot("c09-client-request-review-desktop.png");
  });

  test("Studio overview desktop matches F01", async ({ page }) => {
    await openScenario(page, "studio-overview", "Your studio, in focus.");
    await expect(page).toHaveScreenshot("f01-studio-overview-desktop.png");
  });

  test("Studio delivery board desktop matches F05", async ({ page }) => {
    await openScenario(page, "studio-delivery-board", "Delivery board");
    await expect(page).toHaveScreenshot("f05-studio-delivery-board-desktop.png");
  });

  test("Studio review package desktop matches F07", async ({ page }) => {
    await openScenario(page, "studio-review-package", "Send work for review");
    await expect(page).toHaveScreenshot("f07-studio-review-package-desktop.png");
  });
});

test.describe("FSS Studio mobile visuals", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "fss-studio-mobile",
      "This assertion is captured at the approved mobile viewport.",
    );
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("client sign-in mobile reflows C00", async ({ page }) => {
    await openScenario(page, "client-login", "Sign in to FSS");
    await expect(page).toHaveScreenshot("c00-client-sign-in-mobile.png");
  });

  test("client overview mobile matches M01", async ({ page }) => {
    await openScenario(page, "client-overview", "Your workspace");
    await expect(page).toHaveScreenshot("m01-client-overview-mobile.png");
  });

  test("client request board mobile matches M03", async ({ page }) => {
    await openScenario(page, "client-request-board", "Requests & feedback");
    await expect(page).toHaveScreenshot("m03-client-request-board-mobile.png");
  });

  test("client bug report mobile matches M04", async ({ page }) => {
    await openScenario(page, "client-bug-report", "Report a problem");
    await expect(page).toHaveScreenshot("m04-client-bug-report-mobile.png");
  });

  test("client request review mobile matches M05", async ({ page }) => {
    await openScenario(page, "client-request-review", "Ready for your review");
    await expect(page).toHaveScreenshot("m05-client-request-review-mobile.png");
  });

  test("Studio overview mobile matches M07", async ({ page }) => {
    await openScenario(page, "studio-overview", "Your studio, in focus.");
    await expect(page).toHaveScreenshot("m07-studio-overview-mobile.png");
  });
});
