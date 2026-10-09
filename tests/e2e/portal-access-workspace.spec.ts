import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/visual/fss-studio/studio-portal-access");
  await expect(
    page.getByRole("heading", { level: 1, name: "People and portal access" }),
  ).toBeVisible();
});

test("invitation dialog traps keyboard focus and restores its trigger on Escape", async ({
  page,
}) => {
  const trigger = page.getByRole("button", {
    name: "Invite client",
    exact: true,
  });
  await expect(
    page.getByRole("textbox", { name: "Review reference" }),
  ).not.toBeVisible();
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Invite client",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  await dialog.getByLabel("Review reference").fill("review-42");
  for (let index = 0; index < 8; index += 1) await page.keyboard.press("Tab");
  expect(
    await dialog.evaluate((element) =>
      element.contains(document.activeElement),
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("failed invitation keeps entered review details and success refreshes after acknowledgement", async ({
  page,
}) => {
  let requests = 0;
  await page.route("**/api/portal/admin/portal-access", async (route) => {
    requests += 1;
    const command = route.request().postDataJSON();
    expect(command.action).toBe("invite_existing_client");
    expect(command.reviewReference).toBe("review-42");
    await route.fulfill({
      status: requests === 1 ? 409 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        requests === 1
          ? { error: "Contact changed. Review and retry." }
          : { status: "sent" },
      ),
    });
  });
  await page
    .getByRole("button", { name: "Invite client", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Invite client",
    exact: true,
  });
  await dialog.getByLabel("Invitation type").selectOption("existing_client");
  await dialog.getByLabel("Review reference").fill("review-42");
  await dialog.getByRole("button", { name: "Request invitation" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Contact changed");
  await expect(dialog.getByLabel("Review reference")).toHaveValue("review-42");
  await dialog.getByRole("button", { name: "Request invitation" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "accepted by the provider",
  );
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator("#portal-access-result")).toBeFocused();
  await expect(page.getByRole("status")).toContainText(
    "accepted by the provider",
  );
});

test("new client invitation fixes the owner role and disables controls while pending", async ({
  page,
}) => {
  let finish: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/portal/admin/portal-access", async (route) => {
    const command = route.request().postDataJSON();
    expect(command).toEqual({
      action: "invite_client",
      email: "sam@example.test",
      name: "Sam Example",
      reviewReference: "new-client-review-42",
    });
    await waiting;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "sent" }),
    });
  });
  await page
    .getByRole("button", { name: "Invite client", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Invite client",
    exact: true,
  });
  await expect(dialog.getByLabel("Invitation type")).toHaveValue("new_client");
  await dialog.getByLabel("Full name").fill("Sam Example");
  await dialog.getByLabel("Email address").fill("sam@example.test");
  await dialog.getByLabel("Review reference").fill("new-client-review-42");
  await dialog.getByRole("button", { name: "Request invitation" }).click();
  await expect(
    dialog.getByRole("button", { name: "Request invitation" }),
  ).toBeDisabled();
  await expect(dialog.getByLabel("Invitation type")).toBeDisabled();
  finish?.();
  await expect(dialog.getByRole("status")).toContainText(
    "create their organisation after accepting",
  );
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).not.toBeVisible();
});

test("removal has scoped review and busy controls prevent dismissal", async ({
  page,
}) => {
  let finish: (() => void) | undefined;
  const waiting = new Promise<void>((resolve) => {
    finish = resolve;
  });
  await page.route("**/api/portal/admin/portal-access", async (route) => {
    expect(route.request().postDataJSON().action).toBe("revoke_membership");
    await waiting;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "revoked" }),
    });
  });
  await page
    .getByRole("button", { name: "Remove access", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Remove access",
    exact: true,
  });
  await expect(dialog).toContainText(
    "memberships in other organisations remain separate",
  );
  await dialog.getByLabel("Review reference").fill("removal-42");
  await dialog.getByRole("button", { name: "Confirm removal" }).click();
  await expect(
    dialog.getByRole("button", { name: "Confirm removal" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  finish?.();
  await expect(dialog.getByRole("status")).toContainText("Access removed");
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(dialog).not.toBeVisible();
});

test("invitation deletion requires a review reference and restores keyboard focus", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-portal-access-invitation");
  const trigger = page.getByRole("button", { name: "Delete invitation" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Delete invitation" });
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("client@example.test");
  await expect(
    dialog.getByRole("button", { name: "Confirm deletion" }),
  ).toBeVisible();
  await dialog.getByRole("button", { name: "Confirm deletion" }).click();
  await expect(dialog.getByLabel("Review reference")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(trigger).toBeFocused();
});

test("resending a current invitation requires review and confirms provider acceptance", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-portal-access-invitation");
  await page.route("**/api/portal/admin/portal-access", async (route) => {
    expect(route.request().postDataJSON()).toEqual({
      action: "resend_invitation",
      invitationId: "2e83e9c3-b021-4a55-b117-78c05b456c15",
      kind: "client",
      reviewReference: "review-42",
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "sent" }),
    });
  });
  const trigger = page.getByRole("button", { name: "Resend invitation" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Resend invitation" });
  await dialog.getByRole("button", { name: "Send new invitation" }).click();
  await expect(dialog.getByLabel("Review reference")).toBeFocused();
  await dialog.getByLabel("Review reference").fill("review-42");
  await dialog.getByRole("button", { name: "Send new invitation" }).click();
  await expect(dialog.getByRole("status")).toContainText(
    "accepted by the provider",
  );
  await dialog.getByRole("button", { name: "Done" }).click();
  await expect(page.locator("#portal-access-result")).toBeFocused();
});

test("client can decline from a new link without submitting account details", async ({
  page,
}) => {
  const token = "a".repeat(43);
  await page.route("**/api/portal/access/decline", async (route) => {
    expect(route.request().postDataJSON()).toEqual({ token });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ status: "declined" }),
    });
  });
  await page.goto(
    `/visual/fss-studio/client-invitation-activation?__clerk_ticket=fixture-ticket&decline_token=${token}`,
  );
  await expect(page).not.toHaveURL(/decline_token/);
  await page
    .getByRole("button", { name: "Decline invitation", exact: true })
    .click();
  await page.getByRole("button", { name: "Confirm decline" }).click();
  await expect(page.getByText("You declined this invitation.")).toBeVisible();
});

test("dashboard and dialogs reflow without horizontal overflow at enlarged text", async ({
  page,
}) => {
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  await page
    .getByRole("button", { name: "Invite client", exact: true })
    .click();
  const dialog = page.getByRole("dialog", {
    name: "Invite client",
    exact: true,
  });
  await expect(dialog).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
});
