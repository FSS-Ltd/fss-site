import { expect, test } from "@playwright/test";

const path = "/visual/fss-studio/growth-research-email-review";
const draftId = "11111111-1111-4111-8111-111111111111";

test("research draft can be edited with concise copy and a reworded opt-out", async ({
  page,
}) => {
  const requests: unknown[] = [];
  await page.route(
    `**/api/growth/messages/${draftId}/edit-draft`,
    async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({ json: { ok: true, version: 2 } });
    },
  );
  await page.goto(path);
  await page.getByRole("button", { name: "Edit draft", exact: true }).click();
  await page
    .getByLabel("Subject", { exact: true })
    .fill("A concise edited subject");
  await page
    .getByLabel("Email copy", { exact: true })
    .fill(
      "A portal could help your team.\n\nReply unsubscribe if this is not useful.",
    );
  await page
    .getByRole("button", { name: "Save revision", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Edit draft", exact: true }),
  ).toBeVisible();
  expect(requests).toEqual([
    {
      expectedVersion: 1,
      subject: "A concise edited subject",
      paragraphs: [
        "A portal could help your team.",
        "Reply unsubscribe if this is not useful.",
      ],
    },
  ]);
});

test("research approval confirms the recipient and sends once with explicit permission", async ({
  page,
}) => {
  const requests: unknown[] = [];
  await page.route(
    `**/api/growth/messages/${draftId}/approve-research-send`,
    async (route) => {
      requests.push(route.request().postDataJSON());
      await route.fulfill({
        json: {
          ok: true,
          status: "sent",
          sequenceEnrollmentId: "33333333-3333-4333-8333-333333333333",
        },
      });
    },
  );
  await page.goto(path);
  await page
    .getByRole("button", { name: "Approve & send", exact: true })
    .click();
  const form = page.getByRole("form", { name: "Confirm research email send" });
  await expect(form).toContainText("business@example.test");
  const send = page.getByRole("button", {
    name: "Confirm & send now",
    exact: true,
  });
  await expect(send).toBeDisabled();
  await page
    .getByLabel("Permission to contact this recipient")
    .selectOption("consent");
  await page
    .getByLabel("Review note or permission evidence")
    .fill("Recipient requested this reviewed email.");
  await send.click();
  await expect(page.getByRole("status")).toContainText("Email sent.");
  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    expectedVersion: 1,
    expectedProspectVersion: 1,
    fingerprint: expect.stringMatching(/^[0-9a-f]{64}$/),
    permission: {
      basis: "consent",
      evidence: "Recipient requested this reviewed email.",
    },
  });
  await expect(
    page.getByRole("link", { name: "View delivery status" }),
  ).toHaveAttribute(
    "href",
    "/growth/outreach/sequences/33333333-3333-4333-8333-333333333333",
  );
  await expect(send).toHaveCount(0);
});

test("conflicts and unconfirmed delivery are shown without claiming success", async ({
  page,
}) => {
  await page.route(
    `**/api/growth/messages/${draftId}/approve-research-send`,
    (route) =>
      route.fulfill({
        status: 409,
        json: { message: "The draft changed. Reload and review it." },
      }),
  );
  await page.goto(path);
  await page
    .getByRole("button", { name: "Approve & send", exact: true })
    .click();
  await page
    .getByLabel("Permission to contact this recipient")
    .selectOption("consent");
  await page
    .getByLabel("Review note or permission evidence")
    .fill("Recipient requested this reviewed email.");
  await page
    .getByRole("button", { name: "Confirm & send now", exact: true })
    .click();
  await expect(
    page
      .getByRole("form", { name: "Confirm research email send" })
      .getByRole("alert"),
  ).toContainText("The draft changed.");
  await expect(page.getByText("Email sent.", { exact: true })).toHaveCount(0);
});

test("unconfirmed delivery is not presented as a successful send", async ({
  page,
}) => {
  await page.route(
    `**/api/growth/messages/${draftId}/approve-research-send`,
    (route) =>
      route.fulfill({
        json: {
          ok: true,
          status: "pending",
          sequenceEnrollmentId: "33333333-3333-4333-8333-333333333333",
        },
      }),
  );
  await page.goto(path);
  await page
    .getByRole("button", { name: "Approve & send", exact: true })
    .click();
  await page
    .getByLabel("Permission to contact this recipient")
    .selectOption("consent");
  await page
    .getByLabel("Review note or permission evidence")
    .fill("Recipient requested this reviewed email.");
  await page
    .getByRole("button", { name: "Confirm & send now", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText(
    "Delivery has not yet been confirmed.",
  );
  await expect(page.getByText("Email sent.", { exact: true })).toHaveCount(0);
});

test("permanent delivery failure is visible with a route to its details", async ({
  page,
}) => {
  await page.route(
    `**/api/growth/messages/${draftId}/approve-research-send`,
    (route) =>
      route.fulfill({
        json: {
          ok: true,
          status: "failed",
          sequenceEnrollmentId: "33333333-3333-4333-8333-333333333333",
        },
      }),
  );
  await page.goto(path);
  await page
    .getByRole("button", { name: "Approve & send", exact: true })
    .click();
  await page
    .getByLabel("Permission to contact this recipient")
    .selectOption("consent");
  await page
    .getByLabel("Review note or permission evidence")
    .fill("Recipient requested this reviewed email.");
  await page
    .getByRole("button", { name: "Confirm & send now", exact: true })
    .click();
  await expect(
    page
      .getByRole("region", { name: "Research email decision" })
      .getByRole("alert"),
  ).toContainText("Delivery failed.");
  await expect(
    page.getByText("Delivery has not yet been confirmed.", { exact: false }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("link", { name: "View delivery status" }),
  ).toBeVisible();
});
