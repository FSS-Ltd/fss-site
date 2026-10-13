import { expect, test, type Page } from "@playwright/test";
import {
  AI_RECEPTIONIST_GUIDE_PATH as guidePath,
  AI_RECEPTIONIST_GUIDE_SLUG,
} from "../../lib/ai-receptionist-guide";

async function completeForm(page: Page): Promise<void> {
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Taylor");
  await page.getByLabel("Work email").fill("sam@example.com");
  await page
    .getByLabel("Company", { exact: true })
    .fill("Example Appointments");
}

test("the resource is discoverable and has complete metadata and focused navigation", async ({
  page,
  request,
}) => {
  await page.goto("/resources");
  await page
    .getByRole("link", { name: "View The AI receptionist setup guide" })
    .click();
  await expect(page).toHaveURL(guidePath);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "The AI receptionist setup guide.",
  );
  await expect(
    page.getByRole("navigation", { name: "Free guide", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "Menu", exact: true }),
  ).toHaveCount(0);
  await expect(page.locator("form")).toHaveCount(1);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    `https://faithfulsoftware.dev${guidePath}`,
  );
  await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
    "content",
    "Free AI Receptionist Setup Guide | FSS",
  );
  const schema = await page
    .locator('script[type="application/ld+json"]')
    .allTextContents();
  expect(schema.join("\n")).toContain(
    '"@type":"Person","name":"Jean-Fidele Ntagengwa"',
  );
  expect(schema.join("\n")).toContain('"@type":"BreadcrumbList"');
  const social = await request.get(`/social${guidePath}`);
  expect(social.ok()).toBe(true);
  expect(social.headers()["content-type"]).toContain("image/");
  await page
    .getByRole("link", { name: "Faithful Software Solutions home" })
    .click();
  await expect(page).toHaveURL("/", { timeout: 15000 });
  await expect(
    page.getByRole("navigation", { name: "Free guide", exact: true }),
  ).toHaveCount(0);
  await expect(
    page.locator("header").getByRole("link", { name: "Discuss a project" }),
  ).toBeVisible();
});

for (const newsletterOptIn of [false, true]) {
  test(`instant download preserves newsletter choice ${newsletterOptIn}`, async ({
    page,
    request,
  }) => {
    const submissions: unknown[] = [];
    await page.route("**/api/lead", async (route) => {
      submissions.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true, leadId: "guide-test-lead" } });
    });
    await page.goto(guidePath);
    await page
      .locator("header")
      .getByRole("link", { name: "Get the free guide" })
      .click();
    await expect
      .poll(async () => (await page.locator("#download-form").boundingBox())?.y)
      .toBeLessThan(160);
    const anchor = await page.locator("#download-form").boundingBox();
    expect(anchor?.y).toBeGreaterThanOrEqual(72);
    expect(anchor?.y).toBeLessThan(160);
    const consent = page.getByRole("checkbox", { name: /FSS Field Notes/ });
    await expect(consent).not.toBeChecked();
    await completeForm(page);
    await page
      .getByLabel("Current challenge (optional)")
      .fill("After-hours appointment enquiries");
    if (newsletterOptIn) await consent.check();
    await page.getByRole("button", { name: "Get the free guide" }).click();
    await expect(page).toHaveURL(`${guidePath}/thank-you`);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
      newsletterOptIn,
      resourceSlug: AI_RECEPTIONIST_GUIDE_SLUG,
      sourcePath: guidePath,
      sourceContext: `resource:${AI_RECEPTIONIST_GUIDE_SLUG}`,
      company: "Example Appointments",
      challenge: "After-hours appointment enquiries",
    });
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute(
      "content",
      /noindex/,
    );
    await expect(
      page.getByRole("navigation", { name: "Free guide", exact: true }),
    ).toBeVisible();
    const download = page.getByRole("link", {
      name: "Download the AI receptionist guide (PDF)",
    });
    await expect(download).toHaveAttribute(
      "download",
      "AI_Receptionist_Setup_Guide.pdf",
    );
    const downloadEvent = page.waitForEvent("download");
    await download.click();
    expect((await downloadEvent).suggestedFilename()).toBe(
      "AI_Receptionist_Setup_Guide.pdf",
    );
    const pdf = await request.get(
      "/resource-downloads/ai-receptionist-setup-guide.pdf",
    );
    expect(pdf.ok()).toBe(true);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });
}

test("validation, network and server errors preserve details for retry", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/lead", async (route) => {
    calls += 1;
    if (calls === 1) return route.abort("failed");
    await route.fulfill({
      status: calls === 2 ? 503 : 200,
      json:
        calls === 2
          ? { ok: false, errorMessage: "Please try again shortly." }
          : { ok: true, leadId: "guide-retry" },
    });
  });
  await page.goto(guidePath);
  const submit = page.getByRole("button", { name: "Get the free guide" });
  await submit.click();
  await expect(page.getByLabel("First name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  await expect(page.getByLabel("First name")).toBeFocused();
  await completeForm(page);
  await page.getByLabel("Current challenge (optional)").fill("x".repeat(601));
  await submit.click();
  await expect(page.getByLabel("Current challenge (optional)")).toHaveAttribute(
    "aria-describedby",
    "challenge-error",
  );
  expect(calls).toBe(0);
  await page.getByLabel("Current challenge (optional)").fill("");
  await submit.click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    /Network error/,
  );
  await submit.click();
  await expect(page.locator("form").getByRole("alert")).toHaveText(
    "Please try again shortly.",
  );
  await expect(page.getByLabel("Company", { exact: true })).toHaveValue(
    "Example Appointments",
  );
  await submit.click();
  await expect(page).toHaveURL(`${guidePath}/thank-you`);
  expect(calls).toBe(3);
});

test("pending submissions disable repeat clicks", async ({ page }) => {
  let finishRequest: (() => void) | undefined;
  let calls = 0;
  await page.route("**/api/lead", async (route) => {
    calls += 1;
    await new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    await route.fulfill({ json: { ok: true, leadId: "guide-pending" } });
  });
  await page.goto(guidePath);
  await completeForm(page);
  await page.getByRole("button", { name: "Get the free guide" }).click();
  await expect(
    page.getByRole("button", { name: "Submitting..." }),
  ).toBeDisabled();
  expect(calls).toBe(1);
  finishRequest?.();
  await expect(page).toHaveURL(`${guidePath}/thank-you`);
});

test("previews follow chapters on desktop and stay inline on mobile", async ({
  page,
}, testInfo) => {
  await page.goto(guidePath);
  const desktop = !testInfo.project.name.includes("mobile");
  await expect(page.locator("[data-enhanced]")).toHaveAttribute(
    "data-enhanced",
    String(desktop),
  );
  await page.screenshot({
    path: testInfo.outputPath("hero.png"),
    animations: "disabled",
  });
  for (const [title, image] of [
    ["Your business rules. Written down first.", "workbook"],
    ["A useful prompt. With clear boundaries.", "prompt"],
    ["Test the calls you hope not to get.", "tests"],
  ]) {
    await page
      .getByRole("heading", { name: title, exact: true })
      .scrollIntoViewIfNeeded();
    if (desktop) {
      await expect(page.locator('[data-active="true"] img')).toHaveAttribute(
        "src",
        new RegExp(image),
      );
      await expect(page.locator('[data-active="true"]')).toHaveCSS(
        "opacity",
        "1",
      );
      await expect
        .poll(() =>
          page
            .locator('[data-active="true"] img')
            .evaluate((element) =>
              element instanceof HTMLImageElement ? element.naturalWidth : 0,
            ),
        )
        .toBeGreaterThan(0);
    }
  }
  await page.screenshot({ path: testInfo.outputPath("guide-preview.png") });
  await page
    .locator("header")
    .getByRole("link", { name: "Get the free guide" })
    .click();
  await expect
    .poll(async () => (await page.locator("#download-form").boundingBox())?.y)
    .toBeLessThan(160);
  await page.screenshot({ path: testInfo.outputPath("download.png") });
  await page.getByText("Is the whole setup free?", { exact: true }).click();
  await expect(page.getByText(/The guide is free. Voice usage/)).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    ),
  ).toBe(false);
});

test("keyboard navigation, reduced motion and enlarged text remain usable", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(guidePath);
  await expect(page.locator("[data-enhanced]")).toHaveAttribute(
    "data-enhanced",
    "false",
  );
  await expect(page.getByRole("img", { name: /Page 5:/ })).toBeVisible();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
  await page.getByLabel("First name").focus();
  for (const label of [
    "Last name",
    "Work email",
    "Company",
    "Current challenge (optional)",
  ]) {
    await page.keyboard.press("Tab");
    await expect(page.getByLabel(label, { exact: true })).toBeFocused();
  }
  await page.keyboard.press("Tab");
  const consent = page.getByRole("checkbox", { name: /FSS Field Notes/ });
  await expect(consent).toBeFocused();
  await page.keyboard.press("Space");
  await expect(consent).toBeChecked();
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  const clipped = await page.locator("main").evaluate((main) =>
    [...main.querySelectorAll("h1, h2, h3, input, textarea, button, summary")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        return (
          rect.width > 0 &&
          (rect.left < -1 || rect.right > window.innerWidth + 1)
        );
      })
      .map((element) => element.tagName),
  );
  expect(clipped).toEqual([]);
  await page.screenshot({ path: testInfo.outputPath("enlarged-text.png") });
});

test("guide content and previews remain available without JavaScript", async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: testInfo.project.use.viewport,
    baseURL: testInfo.project.use.baseURL,
  });
  const page = await context.newPage();
  await page.goto(guidePath);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("img", { name: /Page 10:/ })).toBeVisible();
  await expect(page.locator("[data-enhanced]")).toHaveAttribute(
    "data-enhanced",
    "false",
  );
  await page
    .getByText("What tools does the guide use?", { exact: true })
    .click();
  await expect(page.getByText(/The worked pilot uses Retell AI/)).toBeVisible();
  await expect(
    page.getByText(/Please enable JavaScript to request your copy/),
  ).toBeVisible();
  await expect(page.locator("form")).toBeHidden();
  await context.close();
});
