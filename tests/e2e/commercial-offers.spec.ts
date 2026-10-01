import { expect, test } from "@playwright/test";
test("client choices have no default, validate cash/share floors and preserve setup fee", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/client-commercial-offer");
  await expect(
    page.getByRole("heading", { name: "Choose payment terms" }),
  ).toBeVisible();
  await expect(page.getByRole("radio")).toHaveCount(2);
  await expect(page.getByRole("radio").first()).not.toBeChecked();
  await expect(
    page.getByRole("button", { name: "Continue to signing" }),
  ).toBeDisabled();
  await page.getByRole("radio", { name: /Cash payment/ }).check();
  await page.getByLabel("Amount per billing period (EUR)").fill("19.99");
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expect(
    page.getByText("Propose at least 20 EUR per period."),
  ).toBeVisible();
  const submissions: Array<{
    action: string;
    expectedVersion: number;
    recurringAmountMinor?: string;
    percentageBps?: number;
  }> = [];
  await page.route(
    "**/api/portal/organisations/*/commercial-offers",
    async (route) => {
      submissions.push(route.request().postDataJSON());
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({
          message: "This offer changed. Reload before submitting.",
        }),
      });
    },
  );
  await page.getByLabel("Amount per billing period (EUR)").fill("20.00");
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expect(
    page.getByText("This offer changed. Reload before submitting."),
  ).toBeVisible();
  expect(submissions[0]).toMatchObject({
    action: "select",
    expectedVersion: 1,
    recurringAmountMinor: "2000",
  });
  await page.getByRole("radio", { name: /Revenue share/ }).check();
  await page.getByLabel("Revenue share (%)").fill("9.99");
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expect(
    page.getByText("Propose a percentage between 10% and 100%."),
  ).toBeVisible();
  await page.getByLabel("Revenue share (%)").fill("10.00");
  await page.getByRole("button", { name: "Submit proposal" }).click();
  await expect.poll(() => submissions.length).toBe(2);
  expect(submissions[1]).toMatchObject({
    action: "select",
    percentageBps: 1000,
  });
  await expect(
    page.getByRole("heading", { name: "Fixed setup fee" }),
  ).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
test("staff reviews exact combined amount and supplies a rejection reason", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/staff-commercial-offer");
  await expect(
    page.getByRole("heading", { name: "Review payment proposal" }),
  ).toBeVisible();
  await expect(page.getByText(/€20.00/).first()).toBeVisible();
  await expect(page.getByLabel("Reason for rejecting")).toBeVisible();
  const total = page.getByLabel("Ongoing support: total per period (EUR)");
  await total.fill("19.99");
  await page
    .getByRole("button", { name: "Approve proposal and prepare signing" })
    .click();
  await expect(
    page.getByText("Allocations must equal the client's exact proposed total."),
  ).toBeVisible();
  await total.fill("20.00");
  await page.getByLabel("Ongoing support: discount (EUR)").fill("1.00");
  await page.getByLabel("Ongoing support: recorded tax (EUR)").fill("2.00");
  let approved = false;
  await page.route(
    "**/api/portal/admin/clients/*/commercial-offers",
    async (route) => {
      expect(route.request().postDataJSON()).toMatchObject({
        action: "approve",
        expectedVersion: 1,
        draft: {
          currency: "EUR",
          lines: [
            { unitPence: "10000", taxPence: "2000", discountPence: "0" },
            { unitPence: "1900", taxPence: "200", discountPence: "100" },
          ],
        },
      });
      approved = true;
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ message: "Review changed. Reload." }),
      });
    },
  );
  await page
    .getByRole("button", { name: "Approve proposal and prepare signing" })
    .click();
  await expect.poll(() => approved).toBe(true);
  await expect(page.getByText("Review changed. Reload.")).toBeVisible();
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > window.innerWidth,
  );
  expect(overflow).toBe(false);
});
