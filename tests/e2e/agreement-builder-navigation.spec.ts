import { expect, test } from "@playwright/test";

const backwardSteps = [
  {
    stage: "scope",
    button: "Back to work",
    destination: "Work",
    field: "goals",
  },
  {
    stage: "fees",
    button: "Back to scope",
    destination: "Scope",
    field: "rate",
  },
  {
    stage: "people",
    button: "Back to fees",
    destination: "Fees",
    field: "billingContact",
  },
  { stage: "document", button: "Back to people", destination: "People" },
  { stage: "review", button: "Back to document", destination: "Document" },
] as const;

for (const scenario of backwardSteps) {
  test(`${scenario.stage} returns without validation or a draft request`, async ({
    page,
  }) => {
    const requests: string[] = [];
    await page.route(
      "**/api/portal/admin/clients/*/agreement-drafts",
      async (route) => {
        requests.push(route.request().method());
        await route.fulfill({
          status: 503,
          json: { error: "Draft service unavailable." },
        });
      },
    );
    await page.goto(
      `/visual/fss-studio/studio-agreement-builder-${scenario.stage}`,
    );
    await expect(page.locator("h2:focus")).toBeVisible();
    if ("field" in scenario) {
      if (scenario.field === "rate")
        await page
          .getByLabel(/^Rate \(£\)/)
          .first()
          .fill("");
      else await page.locator(`[name="${scenario.field}"]`).fill("");
    }
    await page
      .getByRole("button", { name: scenario.button, exact: true })
      .click();
    await expect(
      page
        .getByRole("list", { name: "Agreement builder steps" })
        .locator('[aria-current="step"]'),
    ).toContainText(scenario.destination);
    expect(requests).toEqual([]);
  });
}

test("returning to scope preserves invalid fee edits and validates them when continuing", async ({
  page,
}) => {
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      const command = route.request().postDataJSON();
      await route.fulfill({
        json: {
          id: command.draftId,
          step: command.step,
          content: command.content,
          version: command.expectedVersion + 1,
        },
      });
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-fees");
  await expect(page.locator("h2:focus")).toBeVisible();
  await page.getByLabel(/^Rate \(£\)/).fill("unfinished amount");
  await page
    .getByRole("button", { name: "Back to scope", exact: true })
    .click();
  await page.getByLabel("Client goals").fill("Revised booking outcome.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue to fees", exact: true })
    .click();
  await expect(page.getByLabel(/^Rate \(£\)/)).toHaveValue("unfinished amount");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page
      .getByRole("list", { name: "Agreement builder steps" })
      .locator('[aria-current="step"]'),
  ).toContainText("Fees");
  await expect(
    page.getByRole("alert").filter({ hasText: "nonnegative amount" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Back to scope", exact: true })
    .click();
  await expect(page.getByLabel("Client goals")).toHaveValue(
    "Revised booking outcome.",
  );
});

test("changing reviewed work clears retained fields from the previous engagement", async ({
  page,
}) => {
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      const command = route.request().postDataJSON();
      await route.fulfill({
        json: {
          id: command.draftId,
          step: command.step,
          content: command.content,
          version: command.expectedVersion + 1,
        },
      });
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-scope");
  await expect(page.locator("h2:focus")).toBeVisible();
  await page
    .getByLabel("Client goals")
    .fill("Unfinished goals for the previous engagement.");
  await page.getByRole("button", { name: "Back to work", exact: true }).click();
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByRole("radio").last().click();
  await page
    .getByRole("button", { name: "Continue to scope", exact: true })
    .click();
  await expect(page.getByLabel("Client goals")).toHaveValue(
    "Give clients a clearer place to track their work.",
  );
  await expect(page.getByLabel("Included deliverables")).toHaveValue(
    "Build a client portal and handover guide.",
  );
});
