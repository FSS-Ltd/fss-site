import assert from "node:assert/strict";
import { createRequire } from "node:module";

// Use an installed Playwright runtime; this check does not add a site dependency.
const require = createRequire(import.meta.url);
const { chromium } = require(
  process.env.PLAYWRIGHT_MODULE_PATH || "playwright",
);
const baseURL = process.env.PUBLIC_SITE_TEST_URL || "http://127.0.0.1:3102";
assert.ok(
  ["127.0.0.1", "localhost"].includes(new URL(baseURL).hostname),
  "Run against a local build only.",
);
const browser = await chromium.launch({
  headless: true,
  channel: process.env.PLAYWRIGHT_BROWSER_CHANNEL || "chrome",
});
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  reducedMotion: "reduce",
});
const page = await context.newPage();
await page.addInitScript(() => {
  window.contactAnalytics = [];
  window.gtag = (...args) => window.contactAnalytics.push(args);
});
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
let payloads = [];
let respond;
async function waitForPayload(count) {
  const deadline = Date.now() + 5000;
  while (payloads.length < count && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.equal(
    payloads.length,
    count,
    "Expected a lead request within five seconds.",
  );
}
await page.route("**/api/lead", async (route) => {
  payloads.push(route.request().postDataJSON());
  const response = await new Promise((resolve) => {
    respond = resolve;
  });
  await route.fulfill({ contentType: "application/json", ...response });
});

try {
  await page.goto(`${baseURL}/contact`);
  const rejectAnalytics = page.getByRole("button", {
    name: "Reject analytics",
    exact: true,
  });
  if (await rejectAnalytics.isVisible()) await rejectAnalytics.click();
  const menu = page.getByRole("button", { name: "Menu", exact: true });
  await menu.focus();
  await page.keyboard.press("Enter");
  assert.equal(await menu.getAttribute("aria-expanded"), "true");
  const menuId = await menu.getAttribute("aria-controls");
  assert.ok(menuId);
  await page
    .locator(`#${menuId}`)
    .getByRole("link", { name: "Services", exact: true })
    .focus();
  await page.keyboard.press("Escape");
  assert.equal(await menu.getAttribute("aria-expanded"), "false");
  assert.equal(
    await menu.evaluate((element) => element === document.activeElement),
    true,
  );

  const faq = page.getByRole("button", {
    name: "Can you work with an existing system?",
    exact: true,
  });
  await faq.focus();
  await page.keyboard.press("Space");
  assert.equal(await faq.getAttribute("aria-expanded"), "true");
  assert.equal(
    await page
      .locator(`#${await faq.getAttribute("aria-controls")}`)
      .isVisible(),
    true,
  );
  await page.keyboard.press("Escape");
  assert.equal(await faq.getAttribute("aria-expanded"), "false");

  const submit = page.getByRole("button", {
    name: "Send project enquiry",
    exact: true,
  });
  await submit.click();
  await page
    .getByText("Please enter your first name.", { exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByLabel("First name", { exact: true })
      .getAttribute("aria-invalid"),
    "true",
  );
  assert.equal(payloads.length, 0);
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  await page.getByLabel("Last name", { exact: true }).fill("Lovelace");
  await page.getByLabel("Work email", { exact: true }).fill("ada@example.org");
  await page
    .getByLabel("Organisation", { exact: true })
    .fill("Example charity");
  await page
    .getByRole("radio", { name: "Custom software", exact: true })
    .focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowRight");
  assert.equal(
    await page
      .getByRole("radio", { name: "App or SaaS", exact: true })
      .isChecked(),
    true,
  );
  await page
    .getByLabel("Project challenge (optional)", { exact: true })
    .fill("Attendance reporting");

  await context.setOffline(true);
  await submit.click();
  await page.getByText(/You are offline/).waitFor();
  assert.equal(payloads.length, 0);
  await context.setOffline(false);
  await submit.click();
  await page.waitForFunction(() =>
    document.querySelector('form[aria-busy="true"]'),
  );
  assert.equal(
    await page
      .getByRole("button", { name: "Sending…", exact: true })
      .isDisabled(),
    true,
  );
  await waitForPayload(1);
  assert.ok(respond);
  respond({
    status: 503,
    body: JSON.stringify({
      ok: false,
      errorMessage: "Please try again later.",
    }),
  });
  await page
    .getByRole("alert")
    .filter({ hasText: /could not send/ })
    .waitFor();
  assert.equal(
    await page.getByLabel("Work email", { exact: true }).inputValue(),
    "ada@example.org",
  );
  await submit.click();
  await page.waitForFunction(() =>
    document.querySelector('form[aria-busy="true"]'),
  );
  await waitForPayload(2);
  respond({
    status: 200,
    body: JSON.stringify({ ok: true, leadId: "local-test" }),
  });
  await page
    .getByRole("heading", {
      name: "Your enquiry has been received",
      exact: true,
    })
    .waitFor();
  assert.equal(payloads[0].submissionId, payloads[1].submissionId);
  assert.equal(payloads[1].sourceContext, "contact-page-v2");
  assert.equal(payloads[1].sourcePath, "/contact");
  assert.equal(payloads[1].challenge, "App or SaaS: Attendance reporting");
  assert.equal(payloads[1].newsletterOptIn, false);
  assert.match(payloads[1].submissionId, /^[0-9a-f-]{36}$/);
  assert.deepEqual(await page.evaluate(() => window.contactAnalytics), []);

  await page.goto(`${baseURL}/contact`);
  await page.evaluate(() => {
    localStorage.setItem(
      "fss.analytics-consent",
      JSON.stringify({
        version: "1",
        choice: "accepted",
        decidedAt: Date.now(),
        expiresAt: Date.now() + 60000,
      }),
    );
  });
  await page.getByLabel("First name", { exact: true }).fill("Ada");
  await page.getByLabel("Last name", { exact: true }).fill("Lovelace");
  await page.getByLabel("Work email", { exact: true }).fill("ada@example.org");
  await page
    .getByLabel("Organisation", { exact: true })
    .fill("Example charity");
  await page.getByRole("checkbox").check();
  await submit.click();
  await waitForPayload(3);
  respond({
    status: 200,
    body: JSON.stringify({ ok: true, leadId: "local-test-2" }),
  });
  await page
    .getByRole("heading", {
      name: "Your enquiry has been received",
      exact: true,
    })
    .waitFor();
  assert.equal(payloads[2].newsletterOptIn, true);
  assert.deepEqual(await page.evaluate(() => window.contactAnalytics), [
    [
      "event",
      "generate_lead",
      { source_context: "contact-page-v2", source_path: "/contact" },
    ],
  ]);

  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    for (const path of ["/", "/services", "/about", "/contact"]) {
      await page.goto(`${baseURL}${path}`);
      assert.equal(await page.locator("h1").count(), 1);
      assert.equal(await page.locator("canvas").count(), 0);
      assert.equal(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        true,
      );
      assert.equal(
        await page.evaluate(
          () =>
            document
              .getAnimations()
              .filter((animation) => animation.playState === "running").length,
        ),
        0,
      );
      if (
        process.env.PUBLIC_SITE_SCREENSHOTS &&
        (path === "/" || path === "/contact")
      ) {
        for (const image of await page.getByRole("img").all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate((element) => element.decode());
        }
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.screenshot({
          path: `${process.env.PUBLIC_SITE_SCREENSHOTS}/${path === "/" ? "home" : "contact"}-${width}.png`,
          fullPage: true,
        });
      }
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of [
    "/blog/bespoke-software-development-for-real-operational-problems",
    "/resources/software-project-readiness-kit",
  ]) {
    await page.goto(`${baseURL}${path}`);
    const headerBox = await page.locator("#fssroot > header").boundingBox();
    const breadcrumbLinks = page
      .getByRole("navigation", { name: "Breadcrumb", exact: true })
      .getByRole("link");
    assert.ok(headerBox, `${path} renders the fixed site header`);
    assert.ok(
      (await breadcrumbLinks.count()) > 0,
      `${path} renders breadcrumb links`,
    );
    for (const link of await breadcrumbLinks.all()) {
      const linkBox = await link.boundingBox();
      assert.ok(linkBox, `${path} breadcrumb link has a visible layout box`);
      assert.ok(
        linkBox.y >= headerBox.y + headerBox.height,
        `${path} breadcrumb link starts at ${linkBox.y}px, below the fixed header ending at ${headerBox.y + headerBox.height}px`,
      );
    }
  }
  const noScriptContext = await browser.newContext({
    javaScriptEnabled: false,
  });
  const noScriptPage = await noScriptContext.newPage();
  await noScriptPage.goto(`${baseURL}/contact`);
  assert.equal(
    await noScriptPage
      .getByRole("button", { name: "Send project enquiry", exact: true })
      .isDisabled(),
    true,
  );
  assert.equal(
    await noScriptPage
      .getByRole("link", {
        name: "Email hello@faithfulsoftware.dev",
        exact: true,
      })
      .isVisible(),
    true,
  );
  await noScriptContext.close();
  assert.deepEqual(errors, []);
  console.log(
    "Public page keyboard, FAQ, choice, contact recovery, API, responsive and no-motion checks passed.",
  );
} finally {
  await browser.close();
}
