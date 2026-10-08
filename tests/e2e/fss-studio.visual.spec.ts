import { expect, test, type Page } from "@playwright/test";

async function openScenario(
  page: Page,
  scenario: string,
  heading: string,
): Promise<void> {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(`/visual/fss-studio/${scenario}`);
  await expect(
    page.getByRole("heading", { level: 1, name: heading }),
  ).toBeVisible();
  await page.evaluate(async () => {
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    window.scrollTo({ top: 0 });
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });
    window.scrollTo({ top: 0 });
  });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
}

async function openClientScenario(
  page: Page,
  scenario: string,
  heading: string,
): Promise<void> {
  await openScenario(page, scenario, heading);
  await expect(page.getByRole("button", { name: "Sign out" })).toBeVisible();
}

async function openPhaseFiveScenario(
  page: Page,
  scenario: string,
  heading: string,
): Promise<void> {
  if (scenario === "client-invitation-expired") {
    await openScenario(page, scenario, heading);
    return;
  }
  await openClientScenario(page, scenario, heading);
}

async function openPhaseSevenScenario(
  page: Page,
  scenario: string,
  heading: string,
): Promise<void> {
  if (
    [
      "client-request-detail",
      "client-request-feedback",
      "client-request-complete",
      "client-request-empty",
      "client-request-no-project",
      "client-request-conflict",
      "client-request-loading",
    ].includes(scenario)
  ) {
    await openClientScenario(page, scenario, heading);
    return;
  }
  await openScenario(page, scenario, heading);
}

async function expectVisualScreenshot(
  page: Page,
  filename: string,
): Promise<void> {
  const visibleContentSelects = await page
    .locator('select:not([aria-label="Colour appearance"])')
    .evaluateAll(
      (selects) =>
        selects.filter((select) => {
          const bounds = select.getBoundingClientRect();
          return (
            bounds.width > 0 &&
            bounds.height > 0 &&
            bounds.bottom > 0 &&
            bounds.top < window.innerHeight &&
            bounds.right > 0 &&
            bounds.left < window.innerWidth
          );
        }).length,
    );

  // Ubuntu Chromium can rasterize native select text differently between CI runs.
  await expect(page).toHaveScreenshot(filename, {
    maxDiffPixels: Math.min(Math.max(visibleContentSelects * 750, 50), 3000),
  });
}

async function expectScopeDefaults(page: Page): Promise<void> {
  await expect(
    page
      .getByRole("combobox", { name: "Choose work" })
      .locator("option:checked"),
  ).toHaveText("Update scope decision");
  await expect(
    page
      .getByRole("combobox", { name: "Scope decision" })
      .locator("option:checked"),
  ).toHaveText("Scope being assessed");
}

const phaseFourDesktopScenarios = [
  [
    "C02",
    "client-getting-started",
    "Your launch checklist",
    "c02-client-getting-started-desktop.png",
  ],
  [
    "C26",
    "client-onboarding-profile",
    "Tell us about your team",
    "c26-client-onboarding-profile-desktop.png",
  ],
  [
    "C27",
    "client-onboarding-assets",
    "Bring your brand with you",
    "c27-client-onboarding-assets-desktop.png",
  ],
  [
    "C28",
    "client-onboarding-booking",
    "Let’s plan the kickoff",
    "c28-client-onboarding-booking-desktop.png",
  ],
  [
    "C29",
    "client-onboarding-complete",
    "Your launch checklist",
    "c29-client-onboarding-complete-desktop.png",
  ],
  [
    "F18",
    "studio-welcome-journeys",
    "A clear start for every client",
    "f18-studio-welcome-journeys-desktop.png",
  ],
  [
    "F19",
    "studio-welcome-builder",
    "Prepare a warm welcome",
    "f19-studio-welcome-builder-desktop.png",
  ],
  [
    "F20",
    "studio-welcome-content",
    "Make the welcome personal",
    "f20-studio-welcome-content-desktop.png",
  ],
  [
    "F21",
    "studio-welcome-access",
    "People, signing and access",
    "f21-studio-welcome-access-desktop.png",
  ],
  [
    "F22",
    "studio-welcome-schedule",
    "Sequence the next steps",
    "f22-studio-welcome-schedule-desktop.png",
  ],
  [
    "F23",
    "studio-welcome-preflight",
    "Ready when you are.",
    "f23-studio-welcome-preflight-desktop.png",
  ],
  [
    "F24",
    "studio-welcome-active",
    "Northstar’s welcome journey",
    "f24-studio-welcome-active-desktop.png",
  ],
  [
    "F25",
    "studio-welcome-recovery",
    "Resolve delivery safely",
    "f25-studio-welcome-recovery-desktop.png",
  ],
  [
    "F26",
    "studio-welcome-templates",
    "Welcome templates",
    "f26-studio-welcome-templates-desktop.png",
  ],
  [
    "F33",
    "studio-checklist-editor",
    "Build the client checklist",
    "f33-studio-checklist-editor-desktop.png",
  ],
  [
    "F35",
    "studio-checklist-task-editor",
    "Create a useful next step",
    "f35-studio-checklist-task-editor-desktop.png",
  ],
] as const;

const phaseFourMobileScenarios = [
  [
    "M02",
    "client-getting-started",
    "Your launch checklist",
    "m02-client-getting-started-mobile.png",
  ],
  [
    "C26",
    "client-onboarding-profile",
    "Tell us about your team",
    "c26-client-onboarding-profile-mobile.png",
  ],
  [
    "C27",
    "client-onboarding-assets",
    "Bring your brand with you",
    "c27-client-onboarding-assets-mobile.png",
  ],
  [
    "C28",
    "client-onboarding-booking",
    "Let’s plan the kickoff",
    "c28-client-onboarding-booking-mobile.png",
  ],
  [
    "C29",
    "client-onboarding-complete",
    "Your launch checklist",
    "c29-client-onboarding-complete-mobile.png",
  ],
  [
    "F18",
    "studio-welcome-journeys",
    "A clear start for every client",
    "f18-studio-welcome-journeys-mobile.png",
  ],
  [
    "F19",
    "studio-welcome-builder",
    "Prepare a warm welcome",
    "f19-studio-welcome-builder-mobile.png",
  ],
  [
    "F20",
    "studio-welcome-content",
    "Make the welcome personal",
    "f20-studio-welcome-content-mobile.png",
  ],
  [
    "F21",
    "studio-welcome-access",
    "People, signing and access",
    "f21-studio-welcome-access-mobile.png",
  ],
  [
    "F22",
    "studio-welcome-schedule",
    "Sequence the next steps",
    "f22-studio-welcome-schedule-mobile.png",
  ],
  [
    "M08",
    "studio-welcome-preflight",
    "Ready when you are.",
    "m08-studio-welcome-preflight-mobile.png",
  ],
  [
    "F24",
    "studio-welcome-active",
    "Northstar’s welcome journey",
    "f24-studio-welcome-active-mobile.png",
  ],
  [
    "F25",
    "studio-welcome-recovery",
    "Resolve delivery safely",
    "f25-studio-welcome-recovery-mobile.png",
  ],
  [
    "F26",
    "studio-welcome-templates",
    "Welcome templates",
    "f26-studio-welcome-templates-mobile.png",
  ],
  [
    "F33",
    "studio-checklist-editor",
    "Build the client checklist",
    "f33-studio-checklist-editor-mobile.png",
  ],
  [
    "F35",
    "studio-checklist-task-editor",
    "Create a useful next step",
    "f35-studio-checklist-task-editor-mobile.png",
  ],
] as const;

const phaseFiveDesktopScenarios = [
  [
    "C03",
    "client-projects",
    "Your projects",
    "c03-client-projects-desktop.png",
  ],
  [
    "C04",
    "client-project-detail",
    "Website & booking experience",
    "c04-client-project-detail-desktop.png",
  ],
  [
    "C12",
    "client-documents",
    "Your documents",
    "c12-client-documents-desktop.png",
  ],
  [
    "C13",
    "client-document-detail",
    "Booking flow · v3",
    "c13-client-document-detail-desktop.png",
  ],
  ["C17", "client-billing", "Billing", "c17-client-billing-desktop.png"],
  ["C18", "client-invoice", "INV-2026-041", "c18-client-invoice-desktop.png"],
  [
    "C19",
    "client-services",
    "Support for what comes next.",
    "c19-client-services-desktop.png",
  ],
  [
    "C20",
    "client-service-enquiry",
    "Tell us what you need",
    "c20-client-service-enquiry-desktop.png",
  ],
  [
    "C21",
    "client-notifications",
    "Your updates",
    "c21-client-notifications-desktop.png",
  ],
  ["C22", "client-help", "How can we help?", "c22-client-help-desktop.png"],
  [
    "C23",
    "client-preferences",
    "Settings",
    "c23-client-preferences-desktop.png",
  ],
  ["C24", "client-team", "Team", "c24-client-team-desktop.png"],
  [
    "S04",
    "client-unavailable",
    "We couldn’t load this page",
    "s04-client-unavailable-desktop.png",
  ],
  [
    "S05",
    "client-invitation-expired",
    "This invitation has expired",
    "s05-client-invitation-expired-desktop.png",
  ],
  [
    "S07",
    "client-document-quarantine",
    "Your documents",
    "s07-client-document-quarantine-desktop.png",
  ],
  [
    "S10",
    "client-viewer-access",
    "Settings",
    "s10-client-viewer-access-desktop.png",
  ],
] as const;

const phaseFiveMobileScenarios = [
  ["C03", "client-projects", "Your projects", "c03-client-projects-mobile.png"],
  [
    "C04",
    "client-project-detail",
    "Website & booking experience",
    "c04-client-project-detail-mobile.png",
  ],
  [
    "C12",
    "client-documents",
    "Your documents",
    "c12-client-documents-mobile.png",
  ],
  [
    "C13",
    "client-document-detail",
    "Booking flow · v3",
    "c13-client-document-detail-mobile.png",
  ],
  ["C17", "client-billing", "Billing", "c17-client-billing-mobile.png"],
  ["C18", "client-invoice", "INV-2026-041", "c18-client-invoice-mobile.png"],
  [
    "C19",
    "client-services",
    "Support for what comes next.",
    "c19-client-services-mobile.png",
  ],
  [
    "C20",
    "client-service-enquiry",
    "Tell us what you need",
    "c20-client-service-enquiry-mobile.png",
  ],
  [
    "C21",
    "client-notifications",
    "Your updates",
    "c21-client-notifications-mobile.png",
  ],
  ["C22", "client-help", "How can we help?", "c22-client-help-mobile.png"],
  [
    "C23",
    "client-preferences",
    "Settings",
    "c23-client-preferences-mobile.png",
  ],
  ["C24", "client-team", "Team", "c24-client-team-mobile.png"],
  [
    "S04",
    "client-unavailable",
    "We couldn’t load this page",
    "s04-client-unavailable-mobile.png",
  ],
  [
    "S05",
    "client-invitation-expired",
    "This invitation has expired",
    "s05-client-invitation-expired-mobile.png",
  ],
  [
    "S07",
    "client-document-quarantine",
    "Your documents",
    "s07-client-document-quarantine-mobile.png",
  ],
  [
    "S10",
    "client-viewer-access",
    "Settings",
    "s10-client-viewer-access-mobile.png",
  ],
] as const;

const phaseSixDesktopScenarios = [
  ["F02", "studio-clients", "Your clients", "f02-studio-clients-desktop.png"],
  [
    "F03",
    "studio-client-detail",
    "Northstar Studio",
    "f03-studio-client-detail-desktop.png",
  ],
  [
    "F04",
    "studio-client-create",
    "Add a client",
    "f04-studio-client-create-desktop.png",
  ],
  [
    "F27",
    "studio-billing-operations",
    "Billing operations",
    "f27-studio-billing-operations-desktop.png",
  ],
  [
    "F28",
    "studio-portal-access",
    "People and portal access",
    "f28-studio-portal-access-desktop.png",
  ],
  [
    "F29",
    "studio-notification-delivery",
    "Notification delivery",
    "f29-studio-notification-delivery-desktop.png",
  ],
  [
    "F30",
    "studio-settings",
    "Studio settings",
    "f30-studio-settings-desktop.png",
  ],
  [
    "F31",
    "studio-project-edit",
    "Edit project",
    "f31-studio-project-edit-desktop.png",
  ],
  [
    "S06",
    "studio-journey-blocked",
    "Two things need your attention",
    "s06-studio-journey-blocked-desktop.png",
  ],
] as const;

const phaseSixMobileScenarios = [
  ["F02", "studio-clients", "Your clients", "f02-studio-clients-mobile.png"],
  [
    "F03",
    "studio-client-detail",
    "Northstar Studio",
    "f03-studio-client-detail-mobile.png",
  ],
  [
    "F04",
    "studio-client-create",
    "Add a client",
    "f04-studio-client-create-mobile.png",
  ],
  [
    "F27",
    "studio-billing-operations",
    "Billing operations",
    "f27-studio-billing-operations-mobile.png",
  ],
  [
    "F28",
    "studio-portal-access",
    "People and portal access",
    "f28-studio-portal-access-mobile.png",
  ],
  [
    "F29",
    "studio-notification-delivery",
    "Notification delivery",
    "f29-studio-notification-delivery-mobile.png",
  ],
  [
    "F30",
    "studio-settings",
    "Studio settings",
    "f30-studio-settings-mobile.png",
  ],
  [
    "F31",
    "studio-project-edit",
    "Edit project",
    "f31-studio-project-edit-mobile.png",
  ],
  [
    "S06",
    "studio-journey-blocked",
    "Two things need your attention",
    "s06-studio-journey-blocked-mobile.png",
  ],
] as const;

const phaseSevenDesktopScenarios = [
  [
    "C08",
    "client-request-detail",
    "Booking confirmation email",
    "c08-client-request-detail-desktop.png",
  ],
  [
    "C10",
    "client-request-feedback",
    "Ready for your review",
    "c10-client-request-feedback-desktop.png",
  ],
  [
    "C11",
    "client-request-complete",
    "Booking confirmation email",
    "c11-client-request-complete-desktop.png",
  ],
  [
    "F06",
    "studio-request-detail",
    "Booking confirmation email",
    "f06-studio-request-detail-desktop.png",
  ],
  [
    "F08",
    "studio-request-scope",
    "Booking confirmation email",
    "f08-studio-request-scope-desktop.png",
  ],
  [
    "F36",
    "studio-request-create",
    "Create work for a client",
    "f36-studio-request-create-desktop.png",
  ],
  [
    "S01",
    "client-request-empty",
    "Requests & feedback",
    "s01-client-request-empty-desktop.png",
  ],
  [
    "S02",
    "client-request-no-project",
    "What would you like us to do?",
    "s02-client-request-no-project-desktop.png",
  ],
  [
    "S03",
    "client-request-conflict",
    "Booking confirmation email",
    "s03-client-request-conflict-desktop.png",
  ],
  [
    "S08",
    "studio-request-move",
    "Delivery board",
    "s08-studio-request-move-desktop.png",
  ],
  [
    "S09",
    "client-request-loading",
    "Requests & feedback",
    "s09-client-request-loading-desktop.png",
  ],
  [
    "E01",
    "client-review-requested-email",
    "Your update is ready.",
    "e01-review-requested-email-desktop.png",
  ],
  [
    "E02",
    "client-work-completed-email",
    "All done.",
    "e02-work-completed-email-desktop.png",
  ],
] as const;

const phaseSevenMobileScenarios = [
  [
    "C08",
    "client-request-detail",
    "Booking confirmation email",
    "c08-client-request-detail-mobile.png",
  ],
  [
    "C10",
    "client-request-feedback",
    "Ready for your review",
    "c10-client-request-feedback-mobile.png",
  ],
  [
    "C11",
    "client-request-complete",
    "Booking confirmation email",
    "c11-client-request-complete-mobile.png",
  ],
  [
    "F06",
    "studio-request-detail",
    "Booking confirmation email",
    "f06-studio-request-detail-mobile.png",
  ],
  [
    "F08",
    "studio-request-scope",
    "Booking confirmation email",
    "f08-studio-request-scope-mobile.png",
  ],
  [
    "F36",
    "studio-request-create",
    "Create work for a client",
    "f36-studio-request-create-mobile.png",
  ],
  [
    "S01",
    "client-request-empty",
    "Requests & feedback",
    "s01-client-request-empty-mobile.png",
  ],
  [
    "S02",
    "client-request-no-project",
    "What would you like us to do?",
    "s02-client-request-no-project-mobile.png",
  ],
  [
    "S03",
    "client-request-conflict",
    "Booking confirmation email",
    "s03-client-request-conflict-mobile.png",
  ],
  [
    "S08",
    "studio-request-move",
    "Delivery board",
    "s08-studio-request-move-mobile.png",
  ],
  [
    "S09",
    "client-request-loading",
    "Requests & feedback",
    "s09-client-request-loading-mobile.png",
  ],
  [
    "E01",
    "client-review-requested-email",
    "Your update is ready.",
    "e01-review-requested-email-mobile.png",
  ],
  [
    "E02",
    "client-work-completed-email",
    "All done.",
    "e02-work-completed-email-mobile.png",
  ],
] as const;

const phaseEightDesktopScenarios = [
  [
    "C14",
    "client-agreement-list",
    "Your agreements",
    "c14-client-agreements-desktop.png",
  ],
  [
    "C15",
    "client-agreement-detail",
    "Website & booking experience",
    "c15-client-agreement-detail-desktop.png",
  ],
  [
    "C16",
    "client-agreement-signing",
    "Review and sign",
    "c16-client-agreement-signing-desktop.png",
  ],
  [
    "C30",
    "client-agreement-signed",
    "Your signed agreement",
    "c30-client-agreement-signed-desktop.png",
  ],
  [
    "F09",
    "studio-agreement-list",
    "Agreements",
    "f09-studio-agreements-desktop.png",
  ],
  [
    "F10",
    "studio-agreement-builder",
    "Create an agreement",
    "f10-studio-agreement-builder-desktop.png",
  ],
  [
    "F11",
    "studio-agreement-builder-scope",
    "Create an agreement",
    "f11-studio-agreement-scope-desktop.png",
  ],
  [
    "F12",
    "studio-agreement-builder-fees",
    "Create an agreement",
    "f12-studio-agreement-fees-desktop.png",
  ],
  [
    "F13",
    "studio-agreement-builder-people",
    "Create an agreement",
    "f13-studio-agreement-people-desktop.png",
  ],
  [
    "F14",
    "studio-agreement-builder-document",
    "Create an agreement",
    "f14-studio-agreement-document-desktop.png",
  ],
  [
    "F15",
    "studio-agreement-builder-review",
    "Create an agreement",
    "f15-studio-agreement-review-desktop.png",
  ],
  [
    "F16",
    "studio-agreement-no-engagement",
    "Create an agreement",
    "f16-studio-agreement-link-desktop.png",
  ],
  [
    "F17",
    "studio-agreement-signed",
    "Signed and recorded",
    "f17-studio-agreement-signed-desktop.png",
  ],
  [
    "F32",
    "studio-engagement-provenance",
    "Create an engagement",
    "f32-studio-engagement-provenance-desktop.png",
  ],
  [
    "F34",
    "studio-signature-evidence",
    "Record signed evidence",
    "f34-studio-signature-evidence-desktop.png",
  ],
  [
    "F37",
    "studio-signing-status",
    "Signing status",
    "f37-studio-signing-status-desktop.png",
  ],
] as const;

const phaseEightMobileScenarios = [
  [
    "C14",
    "client-agreement-list",
    "Your agreements",
    "c14-client-agreements-mobile.png",
  ],
  [
    "C15",
    "client-agreement-detail",
    "Website & booking experience",
    "c15-client-agreement-detail-mobile.png",
  ],
  [
    "C16",
    "client-agreement-signing",
    "Review and sign",
    "c16-client-agreement-signing-mobile.png",
  ],
  [
    "C30",
    "client-agreement-signed",
    "Your signed agreement",
    "c30-client-agreement-signed-mobile.png",
  ],
  [
    "F09",
    "studio-agreement-list",
    "Agreements",
    "f09-studio-agreements-mobile.png",
  ],
  [
    "F10",
    "studio-agreement-builder",
    "Create an agreement",
    "f10-studio-agreement-builder-mobile.png",
  ],
  [
    "F11",
    "studio-agreement-builder-scope",
    "Create an agreement",
    "f11-studio-agreement-scope-mobile.png",
  ],
  [
    "F12",
    "studio-agreement-builder-fees",
    "Create an agreement",
    "f12-studio-agreement-fees-mobile.png",
  ],
  [
    "F13",
    "studio-agreement-builder-people",
    "Create an agreement",
    "f13-studio-agreement-people-mobile.png",
  ],
  [
    "F14",
    "studio-agreement-builder-document",
    "Create an agreement",
    "f14-studio-agreement-document-mobile.png",
  ],
  [
    "F15",
    "studio-agreement-builder-review",
    "Create an agreement",
    "f15-studio-agreement-review-mobile.png",
  ],
  [
    "F16",
    "studio-agreement-no-engagement",
    "Create an agreement",
    "f16-studio-agreement-link-mobile.png",
  ],
  [
    "F17",
    "studio-agreement-signed",
    "Signed and recorded",
    "f17-studio-agreement-signed-mobile.png",
  ],
  [
    "F32",
    "studio-engagement-provenance",
    "Create an engagement",
    "f32-studio-engagement-provenance-mobile.png",
  ],
  [
    "F34",
    "studio-signature-evidence",
    "Record signed evidence",
    "f34-studio-signature-evidence-mobile.png",
  ],
  [
    "F37",
    "studio-signing-status",
    "Signing status",
    "f37-studio-signing-status-mobile.png",
  ],
] as const;

const activeRouteScenarios = [
  [
    "C31",
    "client-organisation-onboarding",
    "Set up your organisation.",
    "c31-client-organisation-onboarding",
  ],
  [
    "F38",
    "studio-client-agreements",
    "Northstar Studio: agreements",
    "f38-studio-client-agreements",
  ],
  [
    "F39",
    "studio-client-requests",
    "Client requests",
    "f39-studio-client-requests",
  ],
  [
    "F40",
    "studio-client-signing",
    "Signing status",
    "f40-studio-client-signing",
  ],
  ["F41", "studio-projects", "Project workspace", "f41-studio-projects"],
  [
    "F42",
    "studio-project-create",
    "Plan a project",
    "f42-studio-project-create",
  ],
  [
    "F43",
    "studio-project-documents",
    "Document register",
    "f43-studio-project-documents",
  ],
] as const;

test.describe("FSS Studio desktop visuals", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "fss-studio-desktop",
      "This assertion is captured at the approved desktop viewport.",
    );
    await page.setViewportSize({ width: 1440, height: 1200 });
  });

  test("client search is right aligned and client creation opens a dialog", async ({
    page,
  }) => {
    await openScenario(page, "studio-clients", "Your clients");
    const resultCount = page.getByText(/\d+ shown/);
    const search = page.getByRole("searchbox", { name: "Search clients" });
    const countBounds = await resultCount.boundingBox();
    const searchBounds = await search.boundingBox();
    if (!countBounds || !searchBounds) {
      throw new Error("Client register toolbar is not visible.");
    }
    expect(searchBounds.x).toBeGreaterThan(countBounds.x + countBounds.width);

    await page.getByRole("button", { name: "Add client" }).click();
    const dialog = page.getByRole("dialog", { name: "Add a client" });
    await expect(dialog).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Display name" }),
    ).toBeVisible();
    await expect(
      dialog.getByRole("textbox", { name: "Email address" }),
    ).toBeVisible();
    await expectVisualScreenshot(page, "studio-client-create-dialog.png");
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();

    await page.getByRole("button", { name: "Add client" }).click();
    await dialog
      .getByRole("textbox", { name: "Display name" })
      .fill("Draft client");
    page.once("dialog", (confirmation) => confirmation.dismiss());
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeVisible();
    page.once("dialog", (confirmation) => confirmation.accept());
    await dialog.getByRole("button", { name: "Cancel" }).click();
    await expect(dialog).toBeHidden();
  });

  test("client sign-in desktop matches C00", async ({ page }) => {
    await openScenario(page, "client-login", "Sign in to FSS");
    await expectVisualScreenshot(page, "c00-client-sign-in-desktop.png");
  });

  for (const [
    screenId,
    scenario,
    heading,
    screenshot,
  ] of activeRouteScenarios) {
    test(`${screenId} active route desktop matches the FSS workspace`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expectVisualScreenshot(page, `${screenshot}-desktop.png`);
    });
  }

  test("client overview desktop matches C01", async ({ page }) => {
    await openScenario(page, "client-overview", "Your workspace");
    await expectVisualScreenshot(page, "c01-client-overview-desktop.png");
  });

  test("client workspace selection desktop matches C25", async ({ page }) => {
    await openScenario(
      page,
      "client-workspace-switcher",
      "Choose your workspace",
    );
    await expectVisualScreenshot(page, "c25-client-workspace-desktop.png");
  });

  test("client request board desktop matches C05", async ({ page }) => {
    await openScenario(page, "client-request-board", "Requests & feedback");
    await expectVisualScreenshot(page, "c05-client-request-board-desktop.png");
  });

  test("client request creation desktop matches C06", async ({ page }) => {
    await openScenario(
      page,
      "client-request-form",
      "What would you like us to do?",
    );
    await expect(
      page.getByRole("combobox", { name: /Project/ }).locator("option:checked"),
    ).toHaveText("Website & booking experience");
    await expectVisualScreenshot(page, "c06-client-request-form-desktop.png");
  });

  test("client bug report desktop matches C07", async ({ page }) => {
    await openScenario(page, "client-bug-report", "Report a problem");
    await expectVisualScreenshot(page, "c07-client-bug-report-desktop.png");
  });

  test("client request review desktop matches C09", async ({ page }) => {
    await openScenario(page, "client-request-review", "Ready for your review");
    await expectVisualScreenshot(page, "c09-client-request-review-desktop.png");
  });

  test("Studio overview desktop matches F01", async ({ page }) => {
    await openScenario(page, "studio-overview", "Studio overview");
    await expectVisualScreenshot(page, "f01-studio-overview-desktop.png");
  });

  test("Studio delivery board desktop matches F05", async ({ page }) => {
    await openScenario(page, "studio-delivery-board", "Delivery board");
    await expectVisualScreenshot(page, "f05-studio-delivery-board-desktop.png");
  });

  test("Studio review package desktop matches F07", async ({ page }) => {
    await openScenario(page, "studio-review-package", "Send work for review");
    await expect(
      page
        .getByRole("combobox", { name: "Choose work" })
        .locator("option:checked"),
    ).toHaveText("Prepare review package");
    await expect(
      page
        .getByRole("combobox", { name: /Deliverable/ })
        .locator("option:checked"),
    ).toHaveText("Booking confirmation email preview · v3");
    await expectVisualScreenshot(page, "f07-studio-review-package-desktop.png");
  });

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseEightDesktopScenarios) {
    test(`Phase 8 ${coverageId} desktop matches the completed agreement journey`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expectVisualScreenshot(page, screenshot);
    });
  }

  test("declining an agreement requires confirmation and restores focus", async ({
    page,
  }) => {
    await openScenario(page, "client-agreement-signing", "Review and sign");
    let requests = 0;
    await page.route(
      "**/api/portal/organisations/**/signing",
      async (route) => {
        requests += 1;
        await route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({ message: "The signing request changed." }),
        });
      },
    );

    const trigger = page.getByRole("button", { name: "Decline agreement" });
    await trigger.click();
    const dialog = page.getByRole("dialog", { name: "Decline agreement?" });
    await expect(dialog).toBeVisible();
    expect(requests).toBe(0);
    await dialog.getByRole("button", { name: "Keep request" }).click();
    await expect(trigger).toBeFocused();

    await trigger.click();
    await dialog.getByRole("button", { name: "Confirm decline" }).click();
    await expect.poll(() => requests).toBe(1);
    await expect(page.getByText("The signing request changed.")).toBeVisible();
  });

  test("prepared signing puts approval before evidence and confirms cancellation", async ({
    page,
  }) => {
    await openScenario(page, "studio-signing-prepared", "Signing status");
    const headings = await page.locator("main h2").allTextContents();
    expect(headings.indexOf("Approve signing")).toBeLessThan(
      headings.indexOf("Delivery and signing"),
    );
    await expect(page.getByText("Not yet open").first()).toBeVisible();
    await expect(page.getByText("Not started")).toBeVisible();

    const trigger = page.getByRole("button", { name: "Cancel signing" });
    await trigger.click();
    const dialog = page.getByRole("dialog", {
      name: "Cancel signing request?",
    });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "Keep request" }).click();
    await expect(trigger).toBeFocused();
  });

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseFourDesktopScenarios) {
    test(`Phase 4 ${coverageId} desktop matches the approved journey`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expectVisualScreenshot(page, screenshot);
    });
  }

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseFiveDesktopScenarios) {
    test(`Phase 5 ${coverageId} desktop matches the approved client workspace`, async ({
      page,
    }) => {
      await openPhaseFiveScenario(page, scenario, heading);
      if (scenario === "client-team") {
        await expect(page.getByRole("combobox", { name: "Role" })).toHaveValue(
          "contributor",
        );
      }
      await expectVisualScreenshot(page, screenshot);
    });
  }

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseSixDesktopScenarios) {
    test(`Phase 6 ${coverageId} desktop matches the Studio workspace`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expectVisualScreenshot(page, screenshot);
    });
  }

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseSevenDesktopScenarios) {
    test(`Phase 7 ${coverageId} desktop matches the completed request journey`, async ({
      page,
    }) => {
      await openPhaseSevenScenario(page, scenario, heading);
      if (scenario === "studio-request-scope") {
        await expectScopeDefaults(page);
      }
      await expectVisualScreenshot(page, screenshot);
    });
  }
});

test.describe("FSS Studio mobile visuals", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "fss-studio-mobile",
      "This assertion is captured at the approved mobile viewport.",
    );
    await page.setViewportSize({ width: 390, height: 844 });
  });

  test("client creation dialog reflows on a phone", async ({ page }) => {
    await openScenario(page, "studio-clients", "Your clients");
    await page.getByRole("button", { name: "Add client" }).click();
    await expect(
      page.getByRole("dialog", { name: "Add a client" }),
    ).toBeVisible();
    const closeBounds = await page
      .getByRole("button", { name: "Close add client" })
      .boundingBox();
    expect(closeBounds?.width).toBeLessThanOrEqual(48);
    await expectVisualScreenshot(
      page,
      "studio-client-create-dialog-mobile.png",
    );
  });

  test("client sign-in mobile reflows C00", async ({ page }) => {
    await openScenario(page, "client-login", "Sign in to FSS");
    await expectVisualScreenshot(page, "c00-client-sign-in-mobile.png");
  });

  for (const [
    screenId,
    scenario,
    heading,
    screenshot,
  ] of activeRouteScenarios) {
    test(`${screenId} active route mobile reflows with FSS navigation`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expectVisualScreenshot(page, `${screenshot}-mobile.png`);
    });
  }

  test("client overview mobile matches M01", async ({ page }) => {
    await openScenario(page, "client-overview", "Your workspace");
    await expectVisualScreenshot(page, "m01-client-overview-mobile.png");
  });

  test("client request board mobile matches M03", async ({ page }) => {
    await openScenario(page, "client-request-board", "Requests & feedback");
    await expect(
      page
        .getByRole("combobox", { name: "Request state" })
        .locator("option:checked"),
    ).toHaveText("All states");
    await expectVisualScreenshot(page, "m03-client-request-board-mobile.png");
  });

  test("client bug report mobile matches M04", async ({ page }) => {
    await openScenario(page, "client-bug-report", "Report a problem");
    await expectVisualScreenshot(page, "m04-client-bug-report-mobile.png");
  });

  test("client request review mobile matches M05", async ({ page }) => {
    await openScenario(page, "client-request-review", "Ready for your review");
    await expectVisualScreenshot(page, "m05-client-request-review-mobile.png");
  });

  test("client agreement detail mobile matches M06", async ({ page }) => {
    await openScenario(
      page,
      "client-agreement-detail",
      "Website & booking experience",
    );
    await expectVisualScreenshot(
      page,
      "m06-client-agreement-detail-mobile.png",
    );
  });

  test("Studio overview mobile matches M07", async ({ page }) => {
    await openScenario(page, "studio-overview", "Studio overview");
    await expectVisualScreenshot(page, "m07-studio-overview-mobile.png");
  });

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseEightMobileScenarios) {
    test(`Phase 8 ${coverageId} mobile matches the completed agreement journey`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expectVisualScreenshot(page, screenshot);
    });
  }

  test("signing and approval remain usable in dark mode with enlarged mobile text", async ({
    page,
  }) => {
    for (const [scenario, heading, action] of [
      ["client-agreement-signing", "Review and sign", "Sign agreement"],
      [
        "studio-signing-prepared",
        "Signing status",
        "Approve and open for signing",
      ],
    ] as const) {
      await openScenario(page, scenario, heading);
      await page.getByLabel("Colour appearance").selectOption("dark");
      await page.evaluate(() => {
        document.documentElement.style.zoom = "1.5";
      });
      await expect(page.getByRole("button", { name: action })).toBeVisible();
      expect(
        await page.evaluate(() => {
          const main = document.querySelector("main");
          return main ? main.scrollWidth <= main.clientWidth + 1 : false;
        }),
      ).toBe(true);
      await page.evaluate(() => {
        document.documentElement.style.zoom = "1";
      });
    }
  });

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseFourMobileScenarios) {
    test(`Phase 4 ${coverageId} mobile matches the approved journey`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expectVisualScreenshot(page, screenshot);
    });
  }

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseFiveMobileScenarios) {
    test(`Phase 5 ${coverageId} mobile matches the approved client workspace`, async ({
      page,
    }) => {
      await openPhaseFiveScenario(page, scenario, heading);
      await expectVisualScreenshot(page, screenshot);
    });
  }

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseSixMobileScenarios) {
    test(`Phase 6 ${coverageId} mobile matches the Studio workspace`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expect(page.locator("summary", { hasText: "More" })).toBeVisible();
      await expectVisualScreenshot(page, screenshot);
    });
  }

  for (const [
    coverageId,
    scenario,
    heading,
    screenshot,
  ] of phaseSevenMobileScenarios) {
    test(`Phase 7 ${coverageId} mobile matches the completed request journey`, async ({
      page,
    }) => {
      await openPhaseSevenScenario(page, scenario, heading);
      if (scenario === "studio-request-scope") {
        await expectScopeDefaults(page);
      }
      await expectVisualScreenshot(page, screenshot);
    });
  }
});

test("client project tabs filter the loaded workspace without losing route context", async ({
  page,
}) => {
  await openClientScenario(page, "client-projects", "Your projects");
  await page.getByRole("button", { name: "Completed 1" }).click();
  await expect(
    page.getByRole("heading", { name: "Completed work" }),
  ).toBeVisible();
  await expect(page.getByRole("heading", { name: "Active work" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Active 1" }).click();
  await expect(
    page.getByRole("heading", { name: "Active work" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Brand landing page" }),
  ).toHaveCount(0);
});

test("F32 validates review input, retains edits after failure and returns to the saved agreement draft", async ({
  page,
}) => {
  await openScenario(
    page,
    "studio-engagement-provenance",
    "Create an engagement",
  );
  const draftId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  let submissions = 0;
  await page.route(
    "**/api/portal/admin/clients/*/engagements",
    async (route) => {
      submissions += 1;
      await route.fulfill({
        status: submissions === 1 ? 503 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          submissions === 1
            ? {
                error:
                  "We could not save this engagement. Your details are still here. Please try again.",
              }
            : {
                engagementId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                draftId,
                draftVersion: 4,
              },
        ),
      });
    },
  );
  await page.route("**/portal/admin/clients/*/agreements/new*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "text/html",
      body: "<main>Agreement draft resumed</main>",
    }),
  );

  const submit = page.getByRole("button", {
    name: "Create & continue to agreement",
  });
  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Engagement name")).toHaveJSProperty(
    "validity.valueMissing",
    true,
  );
  await page
    .getByLabel("Engagement name")
    .fill("Website and booking experience");
  await page.getByLabel("Primary goal").fill("Help customers book online.");
  await page
    .getByRole("textbox", { name: "Proposed scope *" })
    .fill("Website pages and a booking workflow.");
  await page
    .getByLabel("Reviewed source or reference")
    .fill("Founder discovery review");
  const review = page.getByRole("checkbox", {
    name: /I have reviewed this work/,
  });
  await review.focus();
  await page.keyboard.press("Space");
  await expect(review).toBeChecked();

  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(page.locator('section[role="alert"]')).toContainText(
    "details are still here",
  );
  await expect(page.getByLabel("Engagement name")).toHaveValue(
    "Website and booking experience",
  );

  await submit.focus();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(
    new RegExp(
      `/portal/admin/clients/.*/agreements/new\\?draftId=${draftId}\\&step=scope`,
    ),
  );
  await expect(page.getByText("Agreement draft resumed")).toBeVisible();
});

test("appearance selection updates the portal and persists between pages", async ({
  page,
  context,
}) => {
  await openScenario(page, "client-projects", "Your projects");
  await page.getByLabel("Colour appearance").selectOption("dark");
  await expect(page.locator(".portal-theme")).toHaveAttribute(
    "data-appearance",
    "dark",
  );
  await expect
    .poll(() =>
      page
        .locator(".portal-theme")
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--portal-canvas").trim(),
        ),
    )
    .toBe("#0b1421");
  await expectVisualScreenshot(page, "client-projects-dark.png");
  await expect
    .poll(
      async () =>
        (await context.cookies()).find(
          (cookie) => cookie.name === "fss-portal-appearance",
        )?.value,
    )
    .toBe("dark");
  await page.goto("/visual/fss-studio/client-project-detail");
  await expect(page.locator(".portal-theme")).toHaveAttribute(
    "data-appearance",
    "dark",
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.getByLabel("Colour appearance").selectOption("system");
  await expect(page.locator(".portal-theme")).toHaveAttribute(
    "data-appearance",
    "system",
  );
  await expect
    .poll(() =>
      page
        .locator(".portal-theme")
        .evaluate((element) =>
          getComputedStyle(element).getPropertyValue("--portal-canvas").trim(),
        ),
    )
    .toBe("#0b1421");
});
