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
    "We couldn’t load your workspace",
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
    "We couldn’t load your workspace",
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
  ["F03", "studio-client-detail", "Northstar Studio", "f03-studio-client-detail-desktop.png"],
  ["F04", "studio-client-create", "Add a client", "f04-studio-client-create-desktop.png"],
  ["F27", "studio-billing-operations", "Billing operations", "f27-studio-billing-operations-desktop.png"],
  ["F28", "studio-portal-access", "People and portal access", "f28-studio-portal-access-desktop.png"],
  ["F29", "studio-notification-delivery", "Notification delivery", "f29-studio-notification-delivery-desktop.png"],
  ["F30", "studio-settings", "Studio settings", "f30-studio-settings-desktop.png"],
  ["F31", "studio-project-edit", "Edit project", "f31-studio-project-edit-desktop.png"],
  ["S06", "studio-journey-blocked", "Two things need your attention", "s06-studio-journey-blocked-desktop.png"],
] as const;

const phaseSixMobileScenarios = [
  ["F02", "studio-clients", "Your clients", "f02-studio-clients-mobile.png"],
  ["F03", "studio-client-detail", "Northstar Studio", "f03-studio-client-detail-mobile.png"],
  ["F04", "studio-client-create", "Add a client", "f04-studio-client-create-mobile.png"],
  ["F27", "studio-billing-operations", "Billing operations", "f27-studio-billing-operations-mobile.png"],
  ["F28", "studio-portal-access", "People and portal access", "f28-studio-portal-access-mobile.png"],
  ["F29", "studio-notification-delivery", "Notification delivery", "f29-studio-notification-delivery-mobile.png"],
  ["F30", "studio-settings", "Studio settings", "f30-studio-settings-mobile.png"],
  ["F31", "studio-project-edit", "Edit project", "f31-studio-project-edit-mobile.png"],
  ["S06", "studio-journey-blocked", "Two things need your attention", "s06-studio-journey-blocked-mobile.png"],
] as const;

test.describe("FSS Studio desktop visuals", () => {
  test.beforeEach(async ({ page }, testInfo) => {
    test.skip(
      testInfo.project.name !== "fss-studio-desktop",
      "This assertion is captured at the approved desktop viewport.",
    );
    await page.setViewportSize({ width: 1440, height: 1200 });
  });

  test("client sign-in desktop matches C00", async ({ page }) => {
    await openScenario(page, "client-login", "Sign in to FSS");
    await expect(page).toHaveScreenshot("c00-client-sign-in-desktop.png");
  });

  test("client overview desktop matches C01", async ({ page }) => {
    await openScenario(page, "client-overview", "Your workspace");
    await expect(page).toHaveScreenshot("c01-client-overview-desktop.png");
  });

  test("client workspace selection desktop matches C25", async ({ page }) => {
    await openScenario(
      page,
      "client-workspace-switcher",
      "Choose your workspace",
    );
    await expect(page).toHaveScreenshot("c25-client-workspace-desktop.png");
  });

  test("client request board desktop matches C05", async ({ page }) => {
    await openScenario(page, "client-request-board", "Requests & feedback");
    await expect(page).toHaveScreenshot("c05-client-request-board-desktop.png");
  });

  test("client request creation desktop matches C06", async ({ page }) => {
    await openScenario(
      page,
      "client-request-form",
      "What would you like us to do?",
    );
    await expect(page).toHaveScreenshot("c06-client-request-form-desktop.png");
  });

  test("client bug report desktop matches C07", async ({ page }) => {
    await openScenario(page, "client-bug-report", "Report a problem");
    await expect(page).toHaveScreenshot("c07-client-bug-report-desktop.png");
  });

  test("client request review desktop matches C09", async ({ page }) => {
    await openScenario(page, "client-request-review", "Ready for your review");
    await expect(page).toHaveScreenshot(
      "c09-client-request-review-desktop.png",
    );
  });

  test("client agreement list desktop matches C14", async ({ page }) => {
    await openScenario(page, "client-agreement-list", "Your agreements");
    await expect(page).toHaveScreenshot("c14-client-agreements-desktop.png");
  });

  test("client agreement detail desktop matches C15", async ({ page }) => {
    await openScenario(
      page,
      "client-agreement-detail",
      "Website & booking experience",
    );
    await expect(page).toHaveScreenshot(
      "c15-client-agreement-detail-desktop.png",
    );
  });

  test("client agreement signing desktop matches C16", async ({ page }) => {
    await openScenario(page, "client-agreement-signing", "Review and sign");
    await expect(page).toHaveScreenshot(
      "c16-client-agreement-signing-desktop.png",
    );
  });

  test("Studio overview desktop matches F01", async ({ page }) => {
    await openScenario(page, "studio-overview", "Your studio, in focus.");
    await expect(page).toHaveScreenshot("f01-studio-overview-desktop.png");
  });

  test("Studio delivery board desktop matches F05", async ({ page }) => {
    await openScenario(page, "studio-delivery-board", "Delivery board");
    await expect(page).toHaveScreenshot(
      "f05-studio-delivery-board-desktop.png",
    );
  });

  test("Studio review package desktop matches F07", async ({ page }) => {
    await openScenario(page, "studio-review-package", "Send work for review");
    await expect(page).toHaveScreenshot(
      "f07-studio-review-package-desktop.png",
    );
  });

  test("Studio agreement register desktop matches F09", async ({ page }) => {
    await openScenario(page, "studio-agreement-list", "Agreements");
    await expect(page).toHaveScreenshot("f09-studio-agreements-desktop.png");
  });

  test("Studio agreement builder desktop matches F10", async ({ page }) => {
    await openScenario(page, "studio-agreement-builder", "Create an agreement");
    await expect(page).toHaveScreenshot(
      "f10-studio-agreement-builder-desktop.png",
    );
  });

  test("Studio signed agreement desktop matches F17", async ({ page }) => {
    await openScenario(page, "studio-agreement-signed", "Signed and recorded");
    await expect(page).toHaveScreenshot(
      "f17-studio-agreement-signed-desktop.png",
    );
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
      await expect(page).toHaveScreenshot(screenshot);
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
      await expect(page).toHaveScreenshot(screenshot);
    });
  }

  for (const [coverageId, scenario, heading, screenshot] of phaseSixDesktopScenarios) {
    test(`Phase 6 ${coverageId} desktop matches the Studio workspace`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expect(page).toHaveScreenshot(screenshot);
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

  test("client sign-in mobile reflows C00", async ({ page }) => {
    await openScenario(page, "client-login", "Sign in to FSS");
    await expect(page).toHaveScreenshot("c00-client-sign-in-mobile.png");
  });

  test("client overview mobile matches M01", async ({ page }) => {
    await openScenario(page, "client-overview", "Your workspace");
    await expect(page).toHaveScreenshot("m01-client-overview-mobile.png");
  });

  test("client request board mobile matches M03", async ({ page }) => {
    await openScenario(page, "client-request-board", "Requests & feedback");
    await expect(page).toHaveScreenshot("m03-client-request-board-mobile.png");
  });

  test("client bug report mobile matches M04", async ({ page }) => {
    await openScenario(page, "client-bug-report", "Report a problem");
    await expect(page).toHaveScreenshot("m04-client-bug-report-mobile.png");
  });

  test("client request review mobile matches M05", async ({ page }) => {
    await openScenario(page, "client-request-review", "Ready for your review");
    await expect(page).toHaveScreenshot("m05-client-request-review-mobile.png");
  });

  test("client agreement detail mobile matches M06", async ({ page }) => {
    await openScenario(
      page,
      "client-agreement-detail",
      "Website & booking experience",
    );
    await expect(page).toHaveScreenshot(
      "m06-client-agreement-detail-mobile.png",
    );
  });

  test("Studio overview mobile matches M07", async ({ page }) => {
    await openScenario(page, "studio-overview", "Your studio, in focus.");
    await expect(page).toHaveScreenshot("m07-studio-overview-mobile.png");
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
      await expect(page).toHaveScreenshot(screenshot);
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
      await expect(page).toHaveScreenshot(screenshot);
    });
  }

  for (const [coverageId, scenario, heading, screenshot] of phaseSixMobileScenarios) {
    test(`Phase 6 ${coverageId} mobile matches the Studio workspace`, async ({
      page,
    }) => {
      await openScenario(page, scenario, heading);
      await expect(page.locator("summary", { hasText: "More" })).toBeVisible();
      await expect(page).toHaveScreenshot(screenshot);
    });
  }
});
