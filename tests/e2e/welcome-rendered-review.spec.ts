import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";
import {
  prepareWelcome,
  type PreparedWelcome,
} from "../../lib/operations/onboarding/approval";
import {
  signPreview,
  verifyPreview,
} from "../../lib/operations/onboarding/preview-token";
import { buildOnboardingReadiness } from "../../lib/operations/onboarding/readiness";

const templateVersionId = "0e5d47c9-44b3-413c-9a4d-76ed2ee543b5";
const fixtureKey = Buffer.from("local-browser-review-fixture-key-only");
const hash = (bytes: Uint8Array): string =>
  createHash("sha256").update(bytes).digest("hex");

async function prepareReview(page: Page): Promise<{
  prepared: PreparedWelcome;
  token: string;
  commands: Record<string, unknown>[];
}> {
  const commands: Record<string, unknown>[] = [];
  let rendered: PreparedWelcome | undefined;
  let token = "";
  await page.route("**/api/portal/admin/welcome/packs", async (route) => {
    await route.fulfill({
      json: {
        kind: "welcome_pack_applied",
        templateId: "622fc039-3d47-4b05-83e6-6beab9932b9c",
        templateVersionId,
      },
    });
  });
  await page.route("**/visual/no-command", async (route) => {
    const value: unknown = route.request().postDataJSON();
    if (!value || typeof value !== "object")
      throw new Error("Invalid review command");
    const command = Object.fromEntries(Object.entries(value));
    commands.push(command);
    if (command.action === "save_journey_draft") {
      await route.fulfill({
        json: { kind: "journey_draft", draftId: command.draftId, version: 2 },
      });
    } else if (command.action === "preview_welcome") {
      rendered = await prepareWelcome(command.welcome);
      const pdfBase64 = rendered.pdf.toString("base64");
      token = signPreview(
        {
          kind: "welcome",
          agreementId: command.agreementId,
          snapshot: rendered.snapshot,
          pdfBase64,
          workspace: command.workspace,
        },
        fixtureKey,
      );
      await route.fulfill({
        json: {
          preview: {
            kind: "welcome",
            token,
            agreementId: command.agreementId,
            snapshot: rendered.snapshot,
            pdfBase64,
            readiness: buildOnboardingReadiness({
              senderConfigured: true,
              currentAgreement: true,
              noActiveJourney: true,
              contactAvailable: true,
              templateVersionAvailable: true,
              recipientRoleAllowed: true,
              billingConfigured: true,
              signingReady: true,
            }),
          },
        },
      });
    } else if (command.action === "start") {
      expect(command.token).toBe(token);
      expect(command.confirmed).toBe(true);
      expect(verifyPreview(String(command.token), fixtureKey)).toMatchObject({
        snapshot: rendered?.snapshot,
      });
      await route.fulfill({
        json: { journeyId: "8079edf0-d619-4b0e-8f58-7cff188c119c" },
      });
    } else
      throw new Error(`Unexpected review action ${String(command.action)}`);
  });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/visual/fss-studio/studio-welcome-builder");
  const stages = page.getByRole("navigation", {
    name: "Welcome preparation stages",
  });
  await stages.getByRole("button", { name: /Content$/ }).click();
  await page
    .getByRole("button", { name: "Use packet", exact: true })
    .first()
    .click();
  await expect(page.getByLabel("Email subject")).toBeVisible();
  await page
    .getByLabel("Email subject")
    .fill("Your reviewed Northstar welcome");
  await page
    .getByLabel("Proposed scope summary")
    .fill("A new site and a simpler booking path.");
  await page
    .getByLabel("Client responsibilities summary")
    .fill("Provide the content and nominate one reviewer.");
  await stages.getByRole("button", { name: /Schedule$/ }).click();
  await page.getByLabel("First agreed invoice").selectOption({ index: 1 });
  await stages.getByRole("button", { name: /Review$/ }).click();
  await page
    .getByRole("button", { name: "Generate exact email and PDF preview" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Welcome approval preview" }),
  ).toBeVisible();
  if (!rendered) throw new Error("Welcome was not rendered");
  return { prepared: rendered, token, commands };
}

test("exact rendered email and PDF are retained through review and approval", async ({
  page,
}) => {
  const { prepared, token, commands } = await prepareReview(page);
  expect(prepared.snapshot.accessibleHtml).toContain(
    "Proposed scope in brief: A new site and a simpler booking path.",
  );
  expect(prepared.snapshot.accessibleHtml).toContain(
    "Your part in the proposed work: Provide the content and nominate one reviewer.",
  );
  const email = prepared.snapshot.welcome;
  const summary = page
    .locator("summary")
    .filter({ hasText: `${email.subject} · ${email.to}` });
  await summary.click();
  await expect(page.locator("pre")).toHaveText(email.text);
  await page
    .locator("summary")
    .filter({ hasText: /^HTML email$/ })
    .click();
  const htmlFrame = page.getByTitle(`${email.subject} for ${email.to}`);
  await expect(htmlFrame).toHaveAttribute("srcdoc", email.html);
  await expect(htmlFrame).toHaveAttribute("sandbox", "");
  const pdfFrame = page.getByTitle("Exact generated welcome PDF");
  await expect(pdfFrame).toHaveAttribute("src", /^blob:/);
  const pdfLink = page.getByRole("link", {
    name: "Download exact welcome PDF",
  });
  await expect(pdfLink).toHaveAttribute(
    "href",
    (await pdfFrame.getAttribute("src")) ?? "",
  );
  await expect(
    page.getByText(`PDF SHA-256: ${prepared.snapshot.pdfHash}`, {
      exact: true,
    }),
  ).toBeVisible();
  const downloadEvent = page.waitForEvent("download");
  await pdfLink.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("welcome-preview.pdf");
  const file = await download.path();
  if (!file) throw new Error("Missing downloaded preview");
  const bytes = await readFile(file);
  expect(bytes).toEqual(prepared.pdf);
  expect(hash(bytes)).toBe(prepared.snapshot.pdfHash);
  const start = page.getByRole("button", { name: "Start approved welcome" });
  await expect(start).toBeDisabled();
  expect(commands.filter((command) => command.action === "start")).toHaveLength(
    0,
  );
  const confirmation = page.getByRole("checkbox", {
    name: "I reviewed these exact recipients, content, documents and access.",
  });
  await confirmation.check();
  await expect(start).toBeEnabled();
  await confirmation.uncheck();
  await expect(start).toBeDisabled();
  await confirmation.check();
  await start.click();
  await expect(
    page.getByRole("status").filter({ hasText: /^Saved\.$/ }),
  ).toBeVisible();
  expect(commands.filter((command) => command.action === "start")).toEqual([
    { action: "start", token, confirmed: true },
  ]);
});

test("client packet reader and download keep the organisation and approved document scope", async ({
  page,
}) => {
  const { prepared } = await prepareReview(page);
  await page.goto("/visual/fss-studio/client-getting-started");
  const downloadLink = page.getByRole("link", {
    name: "Download PDF",
    exact: true,
  });
  const href = await downloadLink.getAttribute("href");
  expect(href).toMatch(
    /^\/api\/portal\/organisations\/[a-f0-9-]+\/onboarding\/packet\/6931bafc-353b-4008-adb9-7f9a42721a21\/download$/,
  );
  if (!href) throw new Error("Missing approved packet link");
  await page.route(`**${href}`, async (route) => {
    expect(new URL(route.request().url()).pathname).toBe(href);
    await route.fulfill({
      contentType: "application/pdf",
      headers: {
        "content-disposition": 'attachment; filename="northstar-welcome.pdf"',
      },
      body: prepared.pdf,
    });
  });
  await page.getByText("Read your welcome packet", { exact: true }).click();
  const reader = page.getByRole("article", {
    name: "Northstar Studio: your welcome packet",
  });
  await expect(reader).toBeVisible();
  await expect(reader.getByRole("heading", { level: 4 })).toHaveCount(9);
  const downloadEvent = page.waitForEvent("download");
  await downloadLink.click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("northstar-welcome.pdf");
  const file = await download.path();
  if (!file) throw new Error("Missing downloaded approved packet");
  const bytes = await readFile(file);
  expect(bytes.length).toBe(prepared.pdf.length);
  expect(hash(bytes)).toBe(prepared.snapshot.pdfHash);
});
