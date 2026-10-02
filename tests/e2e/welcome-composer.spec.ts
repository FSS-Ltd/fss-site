import { expect, test, type Page } from "@playwright/test";

const restoredDraftId = "2be0dab8-ab42-4b5c-94cf-e65c7b6794e7";
const templateVersionId = "0e5d47c9-44b3-413c-9a4d-76ed2ee543b5";

type Command = Record<string, unknown>;

async function mockCommands(
  page: Page,
  failFirstSave = false,
): Promise<Command[]> {
  const commands: Command[] = [];
  let saves = 0;
  await page.route("**/api/portal/admin/welcome/packs", async (route) => {
    const command: unknown = route.request().postDataJSON();
    if (!command || typeof command !== "object" || !("action" in command))
      throw new Error("Invalid fixture command");
    expect(command.action).toBe("apply_to_client");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        kind: "welcome_pack_applied",
        templateId: "622fc039-3d47-4b05-83e6-6beab9932b9c",
        templateVersionId,
      }),
    });
  });
  await page.route("**/visual/no-command", async (route) => {
    const value: unknown = route.request().postDataJSON();
    if (!value || typeof value !== "object")
      throw new Error("Invalid fixture command");
    const command = Object.fromEntries(Object.entries(value));
    commands.push(command);
    if (command.action === "save_journey_draft") {
      saves += 1;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(
          failFirstSave && saves === 1
            ? { kind: "incomplete" }
            : {
                kind: "journey_draft",
                draftId: command.draftId,
                version: saves + 1,
              },
        ),
      });
    } else {
      await route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "Exact review fixture only." }),
      });
    }
  });
  return commands;
}

async function openBuilder(page: Page): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/visual/fss-studio/studio-welcome-builder");
  await expect(
    page.getByRole("heading", { name: "Prepare a warm welcome" }).first(),
  ).toBeVisible();
}

async function stage(
  page: Page,
  name: "Setup" | "Content" | "Access" | "Schedule" | "Review",
): Promise<void> {
  await page
    .getByRole("navigation", { name: "Welcome preparation stages" })
    .getByRole("button", { name: new RegExp(`${name}$`) })
    .click();
}

async function choosePacket(page: Page): Promise<void> {
  await stage(page, "Content");
  await page
    .getByRole("button", { name: "Use packet", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Email subject")).toBeVisible();
}

async function invoice(page: Page): Promise<void> {
  await stage(page, "Schedule");
  await page.getByLabel("First agreed invoice").selectOption({ index: 1 });
}

test("packet editing survives all five stages and save records the chosen content and checklist", async ({
  page,
}) => {
  const commands = await mockCommands(page);
  await openBuilder(page);
  await choosePacket(page);
  await page
    .getByLabel("Email subject")
    .fill("A personal welcome for Northstar");
  await stage(page, "Access");
  await page
    .getByLabel("Recipient portal role")
    .selectOption("billing_contact");
  await invoice(page);
  await expect(
    page.getByText("09:00 Europe/London", { exact: true }),
  ).toBeVisible();
  await stage(page, "Review");
  await expect(
    page.getByRole("button", { name: "Generate exact email and PDF preview" }),
  ).toBeEnabled();
  await stage(page, "Content");
  await expect(page.getByLabel("Email subject")).toHaveValue(
    "A personal welcome for Northstar",
  );
  await page.getByRole("button", { name: "Save journey draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Draft version" }),
  ).toBeVisible();
  expect(commands).toHaveLength(1);
  expect(commands[0].action).toBe("save_journey_draft");
  expect(commands[0].templateVersionId).toBe(templateVersionId);
  expect(commands[0].recipientRole).toBe("billing_contact");
  expect(JSON.stringify(commands[0].content)).toContain(
    "A personal welcome for Northstar",
  );
  expect(JSON.stringify(commands[0].content)).toContain(
    '"emailArtworkVersion":1',
  );
});

test("packet preview has no fallback photograph and the email has its own artwork", async ({
  page,
}, testInfo) => {
  await mockCommands(page);
  await openBuilder(page);
  await choosePacket(page);
  if (testInfo.project.name.includes("mobile"))
    await page.getByRole("button", { name: "Preview", exact: true }).click();
  const preview = page.getByRole("region", { name: "Welcome packet preview" });
  await expect(preview.getByRole("img")).toHaveCount(1);
  await preview.getByRole("button", { name: "Next", exact: true }).click();
  await expect(preview.getByRole("img")).toHaveCount(0);
  await preview.getByRole("button", { name: "Email", exact: true }).click();
  await expect(preview.getByRole("img")).toHaveAttribute(
    "alt",
    "Website structure and content planning",
  );
  await expect(preview.getByRole("img")).toHaveAttribute(
    "src",
    /website-build-welcome-v1/,
  );
});

test("restoring a saved draft restores personalised content, permissions and stage", async ({
  page,
}) => {
  await mockCommands(page);
  await openBuilder(page);
  await page.getByLabel("Restore saved draft").selectOption(restoredDraftId);
  await expect(page.getByLabel("Email subject")).toHaveValue(
    "Restored welcome for Northstar",
  );
  await page.getByLabel("Email subject").fill("Unsaved replacement");
  await stage(page, "Access");
  await page
    .getByLabel("Recipient portal role")
    .selectOption("billing_contact");
  page.once("dialog", async (dialog) => {
    await dialog.accept();
  });
  await page.getByLabel("Restore saved draft").selectOption(restoredDraftId);
  await expect(page.getByLabel("Email subject")).toHaveValue(
    "Restored welcome for Northstar",
  );
  await stage(page, "Access");
  await expect(page.getByLabel("Recipient portal role")).toHaveValue("owner");
});

test("an incomplete save response retains edits and retry uses the same draft identity", async ({
  page,
}) => {
  const commands = await mockCommands(page, true);
  await openBuilder(page);
  await page.getByLabel("Restore saved draft").selectOption("");
  await choosePacket(page);
  await page.getByLabel("Email subject").fill("Retained through retry");
  await page.getByRole("button", { name: "Save journey draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "not confirmed" }),
  ).toBeVisible();
  await expect(page.getByLabel("Email subject")).toHaveValue(
    "Retained through retry",
  );
  await page.getByRole("button", { name: "Save journey draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Draft version" }),
  ).toBeVisible();
  expect(commands).toHaveLength(2);
  expect(commands[0].expectedVersion).toBe(0);
  expect(commands[0].draftId).not.toBe("a112e4b4-6f45-47ae-a84b-54ba3fb0f81d");
  expect(commands[1].draftId).toBe(commands[0].draftId);
});

test("changed contact blocks stale personalised content from saving or reaching exact review", async ({
  page,
}) => {
  const commands = await mockCommands(page);
  await openBuilder(page);
  await choosePacket(page);
  await invoice(page);
  await stage(page, "Setup");
  await page.getByLabel("Project contact").selectOption({ index: 2 });
  await page.getByRole("button", { name: "Save journey draft" }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /contact changed|packet again/ }),
  ).toBeVisible();
  expect(commands).toHaveLength(0);
  await stage(page, "Review");
  await page
    .getByRole("button", { name: "Generate exact email and PDF preview" })
    .click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: /contact changed|packet again/ }),
  ).toBeVisible();
  expect(commands).toHaveLength(0);
});

test("missing recipient keeps final review disabled and names the missing selection", async ({
  page,
}) => {
  await mockCommands(page);
  await openBuilder(page);
  await choosePacket(page);
  await invoice(page);
  await stage(page, "Setup");
  await page.getByLabel("Project contact").selectOption("");
  await stage(page, "Review");
  await expect(
    page.getByRole("button", { name: "Generate exact email and PDF preview" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Select a contact", { exact: true }),
  ).toBeVisible();
});

test("composer supports keyboard stage selection, mobile edit/preview and enlarged text", async ({
  page,
}, testInfo) => {
  await mockCommands(page);
  await openBuilder(page);
  const contentStage = page
    .getByRole("navigation", { name: "Welcome preparation stages" })
    .getByRole("button", { name: /Content$/ });
  await contentStage.focus();
  await page.keyboard.press("Enter");
  await page
    .getByRole("button", { name: "Use packet", exact: true })
    .first()
    .click();
  if (testInfo.project.name.includes("mobile")) {
    await page.getByRole("button", { name: "Preview", exact: true }).click();
    await expect(
      page.getByRole("region", { name: "Welcome packet preview" }),
    ).toBeVisible();
    await expect(page.getByLabel("Email subject")).not.toBeVisible();
    await page.getByRole("button", { name: "Edit", exact: true }).click();
    await expect(page.getByLabel("Email subject")).toBeVisible();
  }
  await page.evaluate(() => {
    document.documentElement.style.fontSize = "200%";
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

test("packet editor preserves saved and published content when reopened from its library", async ({
  page,
}) => {
  await page.route("**/api/portal/admin/welcome/packs", async (route) => {
    const value: unknown = route.request().postDataJSON();
    if (!value || typeof value !== "object" || !("action" in value))
      throw new Error("Invalid fixture command");
    if (
      value.action === "save_draft" &&
      "expectedVersion" in value &&
      typeof value.expectedVersion === "number"
    ) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "welcome_pack_draft",
          packId: "website_build",
          draftVersion: value.expectedVersion + 1,
        }),
      });
    } else {
      expect(value.action).toBe("publish");
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          kind: "welcome_pack_version",
          packId: "website_build",
          id: "2b07e4d1-842e-44c6-baa3-265d7cb938e8",
          version: 2,
        }),
      });
    }
  });
  await page.goto("/visual/fss-studio/studio-welcome-templates");
  await page
    .getByRole("button", { name: "Open packet", exact: true })
    .first()
    .click();
  await page.getByLabel("Email subject").fill("Saved publication subject");
  await page.getByLabel("Review reference").fill("packet-review-42");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Publish reviewed version" }),
  ).toBeEnabled();
  await page.getByRole("button", { name: "Publish reviewed version" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Published version 2" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Packet library", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Open packet", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Email subject")).toHaveValue(
    "Saved publication subject",
  );
  await expect(
    page.getByText("Published v2", { exact: false }).first(),
  ).toBeVisible();
});

test("invoice selection can be saved without billing while exact review remains blocked", async ({
  page,
}) => {
  const commands = await mockCommands(page);
  await page.goto("/visual/fss-studio/studio-welcome-without-billing");
  await choosePacket(page);
  await stage(page, "Schedule");
  const invoiceChoice = page.getByLabel("First agreed invoice");
  await expect(invoiceChoice).toBeEnabled();
  await invoiceChoice.selectOption("installment:1");
  await expect(invoiceChoice).toHaveValue("installment:1");
  await page.getByRole("button", { name: "Save journey draft" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Draft version" }),
  ).toBeVisible();
  expect(JSON.stringify(commands[0].content)).toContain(
    '"obligationKey":"installment:1"',
  );
  await stage(page, "Access");
  await stage(page, "Schedule");
  await expect(invoiceChoice).toHaveValue("installment:1");
  await stage(page, "Review");
  await expect(
    page.getByText("Configure billing", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Generate exact email and PDF preview" }),
  ).toBeDisabled();
  expect(commands).toHaveLength(1);
});

test("schedule explains the missing agreement rather than offering an empty dropdown", async ({
  page,
}) => {
  await mockCommands(page);
  await openBuilder(page);
  await page.getByLabel("Client agreement").selectOption("");
  await stage(page, "Schedule");
  const invoiceChoice = page.getByLabel("First agreed invoice");
  await expect(invoiceChoice).toBeDisabled();
  await expect(invoiceChoice).toHaveAccessibleDescription(
    "Select a client agreement in Setup to load its agreed invoices.",
  );
  await stage(page, "Setup");
  await page.getByLabel("Client agreement").selectOption({ index: 1 });
  await stage(page, "Schedule");
  await expect(invoiceChoice).toBeEnabled();
  await invoiceChoice.selectOption("installment:1");
  await expect(invoiceChoice).toHaveValue("installment:1");
});
