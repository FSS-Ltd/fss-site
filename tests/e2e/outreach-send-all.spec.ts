import { expect, test, type Page } from "@playwright/test";
import type { MessageReviewData } from "@/lib/growth/dashboard/message-review";

const path = "/visual/fss-studio/growth-research-email-review";
const draftId = "11111111-1111-4111-8111-111111111111";

function review(id: string, researchOnly = true): MessageReviewData {
  return {
    draftTaskId: id,
    version: 2,
    prospectVersion: 3,
    revisionCount: 1,
    prospectId: id,
    researchOnly,
    approvalFingerprint: researchOnly ? "a".repeat(64) : undefined,
    businessName: id === draftId ? "Research Review Example" : "Second Example",
    websiteUrl: "https://example.test",
    fitScore: 72,
    recommendedOffer: "Customer portal",
    estimatedOneOffMinPence: 0,
    estimatedOneOffMaxPence: 0,
    contactName: "Business contact",
    contactEmail: `${id.slice(0, 4)}@example.test`,
    founderEmail: "founder@example.test",
    subject: "A reviewed email",
    previewText: "Useful copy.\n\nReply unsubscribe to opt out.",
    previewHtml: "<p>Useful copy.</p><p>Reply unsubscribe to opt out.</p>",
    editableParagraphs: ["Useful copy.", "Reply unsubscribe to opt out."],
    wordCount: 11,
    imageAltText: "",
    imageByteSize: null,
    visualKind: researchOnly ? "none" : "fallback",
    visualReviewStatus: null,
    citations: [],
    createdAt: "2026-10-26T08:00:00Z",
    eligibility: {
      ready: !id.startsWith("4444"),
      reasons: id.startsWith("4444") ? ["This contact is suppressed."] : [],
    },
    followUpCadence: researchOnly
      ? []
      : [{ day: "Day 1", label: "Personalised email" }],
  };
}

async function mockReviews(page: Page, legacy = false): Promise<void> {
  await page.route("**/api/growth/messages/*/review", async (route) => {
    const id = route.request().url().split("/").at(-2)!;
    await route.fulfill({
      json: { status: "ready", data: review(id, !legacy) },
    });
  });
}

test("send all reviews the displayed drafts, skips blocked recipients, and reports partial delivery", async ({
  page,
}, testInfo) => {
  const requests: { id: string; body: unknown }[] = [];
  await mockReviews(page);
  await page.route(
    "**/api/growth/messages/*/approve-research-send",
    async (route) => {
      const id = route.request().url().split("/").at(-2)!;
      requests.push({ id, body: route.request().postDataJSON() });
      await route.fulfill(
        id === draftId
          ? { json: { status: "sent", sequenceEnrollmentId: "sent-sequence" } }
          : {
              status: 409,
              json: { message: "The draft changed. Reload and review it." },
            },
      );
    },
  );
  await page.goto(path);
  await page.getByRole("button", { name: "Send all", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Review and send all",
    exact: true,
  });
  await expect(dialog).toContainText("This contact is suppressed.");
  await expect(dialog).toContainText("2 ready");
  await page.screenshot({
    path: `output/review/outreach-batch-${testInfo.project.name}.png`,
  });
  const send = dialog.getByRole("button", {
    name: "Confirm & send 2 emails",
    exact: true,
  });
  await expect(send).toBeDisabled();
  const bases = dialog.getByLabel("Permission to contact this recipient");
  const notes = dialog.getByLabel("Review note or permission evidence");
  await expect(bases).toHaveCount(1);
  await expect(notes).toHaveCount(1);
  await bases.selectOption("consent");
  await notes.fill("short");
  await expect(send).toBeDisabled();
  await notes.fill("All recipients requested these reviewed emails.");
  await expect(send).toBeDisabled();
  const acknowledgement = dialog.getByRole("checkbox");
  await acknowledgement.check();
  expect((await acknowledgement.boundingBox())?.width).toBeLessThanOrEqual(24);
  expect(
    await dialog.evaluate(
      (element) => element.scrollWidth <= element.clientWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `output/review/outreach-batch-ready-${testInfo.project.name}.png`,
  });
  await send.click();
  await expect(dialog.getByRole("status")).toContainText("Batch complete");
  await expect(dialog).toContainText("Email sent.");
  await expect(dialog).toContainText("The draft changed.");
  expect(requests.map((request) => request.id)).toEqual([
    draftId,
    "33333333-3333-4333-8333-333333333333",
  ]);
  expect(requests[0]!.body).toMatchObject({
    expectedVersion: 2,
    expectedProspectVersion: 3,
    fingerprint: "a".repeat(64),
    permission: {
      basis: "consent",
      evidence: "All recipients requested these reviewed emails.",
    },
  });
  expect(requests[1]!.body).toMatchObject({
    permission: {
      basis: "consent",
      evidence: "All recipients requested these reviewed emails.",
    },
  });
  await expect(send).toHaveCount(0);
});

test("queue stays idle and cancel never sends or keeps loading after dismissal", async ({
  page,
}) => {
  const reads: string[] = [];
  let writes = 0;
  await page.route("**/api/growth/messages/**", async (route) => {
    if (route.request().method() === "POST") writes++;
    else reads.push(route.request().url());
    await route.fulfill({ status: 503, json: { message: "Unavailable" } });
  });
  await page.goto(path);
  expect(reads).toEqual([]);
  const trigger = page.getByRole("button", { name: "Send all", exact: true });
  await trigger.click();
  const dialog = page.getByRole("dialog", {
    name: "Review and send all",
    exact: true,
  });
  await expect(dialog).toContainText("0 ready");
  await expect(
    dialog.getByRole("button", { name: "Confirm & send 0 emails" }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(trigger).toBeFocused();
  expect(writes).toBe(0);
  expect(new Set(reads).size).toBe(3);
  // Development Strict Mode can abort and replay the first read.
  expect(reads.length).toBeLessThanOrEqual(4);
});

test("legacy batch sends once per recipient and blocks dismissal while sending", async ({
  page,
}) => {
  await mockReviews(page, true);
  let release!: () => void;
  const waiting = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requests: unknown[] = [];
  await page.route("**/api/growth/messages/*/approve-send", async (route) => {
    requests.push(route.request().postDataJSON());
    if (requests.length === 1) await waiting;
    await route.fulfill({
      json: { ok: true, sequenceEnrollmentId: "queued-sequence" },
    });
  });
  await page.goto(path);
  await page.getByRole("button", { name: "Send all", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Review and send all",
    exact: true,
  });
  await expect(dialog).toContainText("2 ready");
  await expect(dialog).toContainText(
    "Starts the Day 1, 5, 11 and 14 sequence.",
  );
  await expect(
    dialog.getByLabel("Permission to contact this recipient"),
  ).toHaveCount(0);
  await dialog.getByRole("checkbox").check();
  const send = dialog.getByRole("button", {
    name: "Confirm & send 2 emails",
    exact: true,
  });
  // Two submit events in the same turn exercise the synchronous duplicate guard.
  await send.evaluate((button) => {
    if (!(button instanceof HTMLButtonElement))
      throw new Error("Expected a send button.");
    button.click();
    button.click();
  });
  await expect(dialog.getByRole("status")).toContainText("Sending 0 of 2");
  await expect(
    dialog.getByRole("button", { name: "Cancel", exact: true }),
  ).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  expect(requests).toEqual([{ expectedVersion: 2 }]);
  release();
  await expect(dialog.getByRole("status")).toContainText(
    "Batch complete. 2 processed.",
  );
  expect(requests).toEqual([{ expectedVersion: 2 }, { expectedVersion: 2 }]);
  await expect(
    dialog.getByText("Approval saved. Delivery has not yet been confirmed.", {
      exact: true,
    }),
  ).toHaveCount(2);
  await expect(dialog.getByText("Email sent.", { exact: true })).toHaveCount(0);
});

test("outreach tabs separate the queues and preserve ten-row draft pages", async ({
  page,
}, testInfo) => {
  await page.goto("/visual/fss-studio/growth-outreach-workspace");
  const drafts = page.getByRole("tab", { name: "Email drafts", exact: true });
  const sequences = page.getByRole("tab", { name: "Sequences", exact: true });
  const audits = page.getByRole("tab", {
    name: "Audit follow-ups",
    exact: true,
  });
  const panel = page.getByRole("tabpanel", {
    name: "Email drafts",
    exact: true,
  });
  await expect(drafts).toHaveAttribute("aria-selected", "true");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(
    panel.getByRole("link", { name: "Review & publish" }),
  ).toHaveCount(10);
  await expect(panel.getByText("Showing 1–10 of 13 drafts")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Previous", exact: true }),
  ).toBeDisabled();
  await page.screenshot({
    path: `output/review/outreach-tabs-${testInfo.project.name}.png`,
  });
  await panel.getByRole("button", { name: "Next", exact: true }).click();
  await expect(
    panel.getByRole("link", { name: "Review & publish" }),
  ).toHaveCount(3);
  await expect(panel.getByText("Showing 11–13 of 13 drafts")).toBeVisible();
  await expect(
    panel.getByRole("button", { name: "Next", exact: true }),
  ).toBeDisabled();
  await sequences.click();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await expect(
    page.getByRole("tabpanel", { name: "Sequences", exact: true }),
  ).toContainText("Active sequence example");
  await page.screenshot({
    path: `output/review/outreach-sequences-${testInfo.project.name}.png`,
  });
  await sequences.press("ArrowRight");
  await expect(audits).toBeFocused();
  await expect(audits).toHaveAttribute("aria-selected", "true");
  await expect(
    page.getByRole("tabpanel", { name: "Audit follow-ups", exact: true }),
  ).toContainText("Audit review example");
  await audits.press("Home");
  await expect(drafts).toBeFocused();
  await drafts.press("End");
  await expect(audits).toBeFocused();
  await audits.press("ArrowRight");
  await expect(drafts).toBeFocused();
  await drafts.press("ArrowLeft");
  await expect(audits).toBeFocused();
  await audits.press("Home");
  await expect(panel.getByText("Showing 11–13 of 13 drafts")).toBeVisible();
  await panel.getByRole("button", { name: "Previous", exact: true }).click();
  await expect(
    panel.getByRole("link", { name: "Review & publish" }),
  ).toHaveCount(10);
});

test("one shared permission sends drafts across every draft page", async ({
  page,
}) => {
  const requests: { id: string; permission: unknown }[] = [];
  await mockReviews(page);
  await page.route(
    "**/api/growth/messages/*/approve-research-send",
    async (route) => {
      const id = route.request().url().split("/").at(-2)!;
      requests.push({
        id,
        permission: route.request().postDataJSON().permission,
      });
      await route.fulfill({
        json: { status: "sent", sequenceEnrollmentId: id },
      });
    },
  );
  await page.goto("/visual/fss-studio/growth-outreach-workspace");
  await page.getByRole("button", { name: "Next", exact: true }).click();
  await page.getByRole("button", { name: "Send all", exact: true }).click();
  const dialog = page.getByRole("dialog", {
    name: "Review and send all",
    exact: true,
  });
  await expect(dialog).toContainText("12 ready · 1 skipped");
  const basis = dialog.getByLabel("Permission to contact this recipient");
  const reason = dialog.getByLabel("Review note or permission evidence");
  await expect(basis).toHaveCount(1);
  await expect(reason).toHaveCount(1);
  await basis.selectOption("corporate_legitimate_interests");
  await reason.fill(
    "Verified corporate recipients for this reviewed campaign.",
  );
  await dialog.getByRole("checkbox").check();
  await dialog
    .getByRole("button", { name: "Confirm & send 12 emails", exact: true })
    .click();
  await expect(dialog.getByRole("status")).toContainText(
    "Batch complete. 12 processed.",
  );
  expect(requests).toHaveLength(12);
  expect(new Set(requests.map((request) => request.id)).size).toBe(12);
  expect(requests.some((request) => request.id === draftId)).toBe(true);
  expect(requests.some((request) => request.id.endsWith("000000000010"))).toBe(
    true,
  );
  for (const request of requests)
    expect(request.permission).toEqual({
      basis: "corporate_legitimate_interests",
      evidence: "Verified corporate recipients for this reviewed campaign.",
    });
});
