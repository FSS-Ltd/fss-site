import { expect, test } from "@playwright/test";

for (const [scenario, title, message] of [
  [
    "client-agreements-disabled",
    "Your agreements",
    "Signing is not available yet",
  ],
  ["client-billing-disabled", "Billing", "Online billing is not available yet"],
]) {
  test(`${scenario} explains availability and preserves workspace navigation`, async ({
    page,
  }) => {
    await page.goto(`/visual/fss-studio/${scenario}`);
    await expect(
      page.getByRole("heading", { name: title, exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("heading", { name: message })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Back to workspace" }),
    ).toHaveAttribute("href", /organisationId=/);
    await expect(
      page.getByRole("link", { name: "Get help", exact: true }),
    ).toHaveAttribute("href", /organisationId=/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
  });
}

test("agreements explain publication and distinguish recorded signatures", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/client-agreement-empty");
  await expect(
    page.getByRole("heading", { name: "No agreements shared yet" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Action needed" }),
  ).toHaveCount(0);
  await page.goto("/visual/fss-studio/client-agreement-recorded");
  await expect(
    page.getByRole("heading", { name: "In progress", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Your signature is recorded", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review agreement", exact: true }),
  ).toHaveCount(0);
});

test("prepared admin agreements lead directly to review and publication", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-agreement-prepared");
  await expect(
    page.getByText("Ready to publish", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Review and publish for signing" }),
  ).toHaveAttribute("href", /\/signing$/);
  await expect(
    page.getByRole("button", { name: "Prepare for signing" }),
  ).toHaveCount(0);
});

test("signing requires consent and records a successful response once", async ({
  page,
}) => {
  let submissions = 0;
  await page.route("**/api/portal/organisations/*/signing", async (route) => {
    submissions += 1;
    expect(route.request().postDataJSON()).toMatchObject({
      action: "sign",
      typedName: "Alex Morgan",
      authority: true,
      consent: true,
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });
  await page.goto("/visual/fss-studio/client-agreement-signing");
  await page
    .getByRole("button", { name: "Sign agreement", exact: true })
    .click();
  expect(submissions).toBe(0);
  await page
    .getByRole("textbox", { name: "Full legal name" })
    .fill("Alex Morgan");
  await page.getByRole("textbox", { name: "Role / position" }).fill("Director");
  await page
    .getByRole("checkbox", {
      name: "I have authority to bind the named organisation.",
      exact: true,
    })
    .check();
  await page.locator('input[name="consent"]').check();
  await page
    .getByRole("button", { name: "Sign agreement", exact: true })
    .click();
  await expect(
    page.getByText(
      "Your signature has been recorded. Final documents will be available after all required signatures are processed.",
      { exact: true },
    ),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign agreement", exact: true }),
  ).toBeDisabled();
  expect(submissions).toBe(1);
});
