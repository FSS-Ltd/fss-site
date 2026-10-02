import { expect, test, type Page } from "@playwright/test";

const resourcePath = "/resources/ai-prompts-for-plumbers";

async function completeForm(page: Page): Promise<void> {
  await page.getByLabel("First name").fill("Sam");
  await page.getByLabel("Last name").fill("Taylor");
  await page.getByLabel("Business name").fill("Taylor Plumbing");
  await page.getByLabel("Email", { exact: true }).fill("sam@example.com");
}

for (const newsletterOptIn of [false, true]) {
  test(`provides the PDF after a saved lead with newsletter consent ${newsletterOptIn}`, async ({
    page,
    request,
  }) => {
    const submissions: unknown[] = [];
    await page.route("**/api/lead", async (route) => {
      submissions.push(route.request().postDataJSON());
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true, leadId: "lead-1" }),
      });
    });

    await page.goto(resourcePath);
    await expect(
      page.getByRole("heading", {
        name: "Less admin. More time on the tools.",
      }),
    ).toBeVisible();
    await expect(
      page.getByText("One prompt for each everyday task."),
    ).toBeVisible();
    const checkbox = page.getByRole("checkbox", { name: /FSS Field Notes/ });
    await expect(checkbox).not.toBeChecked();
    await completeForm(page);
    if (newsletterOptIn) {
      await checkbox.click();
      await expect(checkbox).toBeChecked();
    }

    await page.getByRole("button", { name: "Get the free prompt kit" }).click();
    await expect(page).toHaveURL(`${resourcePath}/thank-you`);
    expect(submissions).toHaveLength(1);
    expect(submissions[0]).toMatchObject({
      firstName: "Sam",
      lastName: "Taylor",
      company: "Taylor Plumbing",
      workEmail: "sam@example.com",
      newsletterOptIn,
      resourceSlug: "ai-prompts-for-plumbers",
      sourcePath: resourcePath,
    });
    const download = page.getByRole("link", {
      name: "Download the prompt kit (PDF)",
    });
    await expect(download).toHaveAttribute(
      "href",
      "/resource-downloads/ai-prompts-for-plumbers.pdf",
    );
    const pdf = await request.get(
      "/resource-downloads/ai-prompts-for-plumbers.pdf",
    );
    expect(pdf.ok()).toBe(true);
    expect(pdf.headers()["content-type"]).toContain("application/pdf");
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
  });
}

test("invalid and failed submissions preserve the entered details for retry", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/lead", async (route) => {
    calls += 1;
    await route.fulfill({
      status: calls === 1 ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        calls === 1
          ? { ok: false, errorMessage: "Please try again shortly." }
          : { ok: true, leadId: "lead-2" },
      ),
    });
  });

  await page.goto(resourcePath);
  await page.getByRole("button", { name: "Get the free prompt kit" }).click();
  await expect(page.getByText("Please enter your first name.")).toBeVisible();
  await expect(page.getByLabel("First name")).toHaveAttribute(
    "aria-invalid",
    "true",
  );
  expect(calls).toBe(0);

  await completeForm(page);
  await page.getByRole("button", { name: "Get the free prompt kit" }).click();
  await expect(page.locator("form [role='alert']")).toHaveText(
    "Please try again shortly.",
  );
  await expect(page).toHaveURL(resourcePath);
  await expect(page.getByLabel("Business name")).toHaveValue("Taylor Plumbing");
  await page.getByRole("button", { name: "Get the free prompt kit" }).click();
  await expect(page).toHaveURL(`${resourcePath}/thank-you`);
  expect(calls).toBe(2);
});

test("pending submission disables repeat clicks and existing resource forms stay unchanged", async ({
  page,
}) => {
  await page.goto("/resources/manual-process-audit-fss");
  await expect(page.getByLabel("Current challenge (optional)")).toBeVisible();
  await expect(page.getByLabel("Work email")).toBeVisible();

  let finishRequest: (() => void) | undefined;
  let calls = 0;
  await page.route("**/api/lead", async (route) => {
    calls += 1;
    await new Promise<void>((resolve) => {
      finishRequest = resolve;
    });
    await route.fulfill({ json: { ok: true, leadId: "lead-3" } });
  });
  await page.goto(resourcePath);
  await completeForm(page);
  await page.getByRole("button", { name: "Get the free prompt kit" }).click();
  await expect(
    page.getByRole("button", { name: "Submitting..." }),
  ).toBeDisabled();
  expect(calls).toBe(1);
  finishRequest?.();
  await expect(page).toHaveURL(`${resourcePath}/thank-you`);
});

test("resource listing and compact layout remain usable on narrow screens", async ({
  page,
}, testInfo) => {
  await page.goto("/resources");
  await expect(
    page.getByRole("link", { name: "View AI Prompts for Plumbers" }),
  ).toBeVisible();
  await page.goto(resourcePath);
  await page.screenshot({
    path: testInfo.outputPath("landing-page.png"),
    fullPage: true,
  });
  if (testInfo.project.name.includes("mobile")) {
    const intro = await page.getByRole("heading", { level: 1 }).boundingBox();
    const form = await page
      .getByRole("heading", { name: "Get the six-page guide" })
      .boundingBox();
    expect(intro && form && form.y > intro.y).toBeTruthy();
    const hasOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    expect(hasOverflow).toBe(false);
  }
});

test("form supports keyboard consent and enlarged text", async ({
  page,
}, testInfo) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(resourcePath);
  await page.getByLabel("First name").focus();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Last name")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Business name")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByLabel("Email", { exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  const consent = page.getByRole("checkbox", { name: /FSS Field Notes/ });
  await expect(consent).toBeFocused();
  await page.keyboard.press("Space");
  await expect(consent).toBeChecked();
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "privacy policy" }),
  ).toBeFocused();

  if (testInfo.project.name.includes("mobile")) {
    await page.evaluate(() => {
      document.documentElement.style.fontSize = "200%";
    });
    const clippedContent = await page.locator("main").evaluate((main) =>
      [...main.querySelectorAll("*")]
        .filter((element) => {
          const { left, right } = element.getBoundingClientRect();
          return left < -1 || right > window.innerWidth + 1;
        })
        .map((element) => element.tagName),
    );
    expect(clippedContent).toEqual([]);
  }
});
