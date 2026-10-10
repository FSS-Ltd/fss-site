import { expect, test } from "@playwright/test";
import type {
  AgreementBuilderDraftContent,
  AgreementBuilderStep,
} from "@/lib/operations/agreements/builder-draft-schema";

test("scope shows focused groups and retains edits while moving backward", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-agreement-builder-scope");
  await expect(page.locator("[data-builder-group]:visible")).toHaveCount(1);
  await page.getByLabel("Client goals").fill("Make booking simpler.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Set clear boundaries" }),
  ).toBeVisible();
  await expect(page.getByLabel("Client goals")).toBeHidden();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Client goals")).toHaveValue(
    "Make booking simpler.",
  );
});

test("reviewed work advances on deliberate activation, never keyboard arrow exploration", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-agreement-builder");
  const choice = page.getByRole("radio").first();
  await choice.focus();
  await page.keyboard.press("ArrowDown");
  await expect(
    page.getByRole("textbox", { name: "Give this agreement a name" }),
  ).toBeHidden();
  await choice.click();
  await expect(
    page.getByRole("textbox", { name: "Give this agreement a name" }),
  ).toBeVisible();
  await expect(page.locator("[data-builder-group]:visible h2")).toBeFocused();
});

test("failed saves show an error and keep the current stage and edits", async ({
  page,
}) => {
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      await route.fulfill({
        status: 503,
        json: {
          error:
            "We could not save this agreement draft. Your edits are still here. Please try again.",
        },
      });
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-scope");
  await page.getByLabel("Client goals").fill("Keep my edits.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Your edits are still here" }),
  ).toContainText("Your edits are still here");
  await expect(page.getByLabel("Client goals")).toHaveValue("Keep my edits.");
  await expect(
    page
      .getByRole("list", { name: "Agreement builder steps" })
      .locator('[aria-current="step"]'),
  ).toHaveText("Scope");
});

test("creation errors are distinct from draft-save errors", async ({
  page,
}) => {
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      expect(route.request().postDataJSON().action).toBe("finalise");
      await route.fulfill({
        status: 503,
        json: {
          error:
            "We could not create this agreement. Your saved draft is still available. Please try again.",
        },
      });
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-review");
  await page
    .getByRole("button", { name: "Create agreement", exact: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "We could not create" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Create agreement", exact: true }),
  ).toBeEnabled();
});

test("saved stages resume at their first group and keyboard activation works", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-agreement-builder");
  const choices = page.getByRole("radio");
  await expect(choices).toHaveCount(2);
  await expect(choices.first()).toBeChecked();
  await choices.first().focus();
  await page.keyboard.press("ArrowDown");
  await expect(choices.last()).toBeChecked();
  await expect(page.locator('[data-builder-group="0"]')).toBeVisible();
  await page.keyboard.press("Space");
  await expect(page.locator('[data-builder-group="1"]')).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-builder-group="0"]')).toBeVisible();
});

test("save reveals and focuses an invalid hidden group", async ({ page }) => {
  let requests = 0;
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      requests += 1;
      await route.abort();
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-scope");
  await page.getByLabel("Client goals").fill("");
  // A restored or programmatically changed hidden field still participates in save validation.
  await page
    .locator('textarea[name="terms"]')
    .evaluate((element: HTMLTextAreaElement) => {
      element.value = "";
    });
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(page.getByLabel("Client goals")).toBeFocused();
  await page.getByLabel("Client goals").fill("Complete goal.");
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByRole("textbox", { name: "Set clear boundaries" }),
  ).toBeFocused();
  expect(requests).toBe(0);
});

test("fees retain service values and reveal malformed amounts on save", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-agreement-builder-fees");
  await page.getByLabel(/^Rate \(£\)/).fill("not an amount");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Set ongoing compensation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel(/^Rate \(£\)/)).toHaveValue("not an amount");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByRole("heading", { name: "Price the services" }),
  ).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: /decimal|amount/i }),
  ).toBeVisible();
});

test("requests disable controls, successful stage changes persist all mounted inputs", async ({
  page,
}) => {
  let release: () => void = () => {};
  const responseReady = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      const command = route.request().postDataJSON();
      expect(command.step).toBe("fees");
      expect(command.content.agreement.goals).toBe("Persist every group.");
      expect(command.content.agreement.terms).toBe("Reviewed boundaries.");
      expect(command.content.agreement.responsibilities).toBeTruthy();
      await responseReady;
      await route.fulfill({
        json: {
          id: command.draftId,
          step: command.step,
          version: 4,
          content: command.content,
        },
      });
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-scope");
  await page.getByLabel("Client goals").fill("Persist every group.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("textbox", { name: "Set clear boundaries" })
    .fill("Reviewed boundaries.");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("button", { name: "Continue to fees", exact: true })
    .click();
  await expect(page.getByLabel("Client responsibilities")).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Back", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("status").filter({ hasText: "Saving draft" }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole("heading", { name: "Price the services" }),
  ).toBeFocused();
  await expect(
    page.getByRole("status").filter({ hasText: "Draft saved." }),
  ).toBeVisible();
});

test("reduced motion disables group movement and the form fits the viewport", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/visual/fss-studio/studio-agreement-builder-scope");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  expect(
    await page
      .locator("[data-builder-group]:visible")
      .evaluate((element) => getComputedStyle(element).animationName),
  ).toBe("none");
  await expect(page.locator("[data-builder-group]:visible h2")).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});

for (const appearance of ["light", "dark"] as const) {
  test(`document text exceeds 4.5:1 contrast in ${appearance} appearance`, async ({
    page,
    baseURL,
  }) => {
    await page.context().addCookies([
      {
        name: "fss-portal-appearance",
        value: appearance,
        url: baseURL ?? "http://127.0.0.1:3219",
      },
    ]);
    await page.goto("/visual/fss-studio/studio-agreement-builder-document");
    const preview = page
      .locator("section")
      .filter({
        has: page.getByText("FSS Studio / Agreement draft", { exact: true }),
      })
      .last();
    const ratios = await preview.evaluate((card) => {
      const luminance = (colour: string): number => {
        const rgb =
          colour
            .match(/[\d.]+/g)
            ?.slice(0, 3)
            .map(Number) ?? [];
        return rgb
          .map((value) => {
            const c = value / 255;
            return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
          })
          .reduce(
            (total, channel, index) =>
              total + channel * [0.2126, 0.7152, 0.0722][index],
            0,
          );
      };
      const background = luminance(getComputedStyle(card).backgroundColor);
      return [...card.querySelectorAll("h3, p, dt, dd")].map((element) => {
        const foreground = luminance(getComputedStyle(element).color);
        return (
          (Math.max(foreground, background) + 0.05) /
          (Math.min(foreground, background) + 0.05)
        );
      });
    });
    expect(ratios.length).toBeGreaterThan(10);
    for (const ratio of ratios) expect(ratio).toBeGreaterThanOrEqual(4.5);
  });
}

for (const stage of [
  "",
  "-scope",
  "-fees",
  "-people",
  "-document",
  "-review",
]) {
  test(`guided agreement ${stage || "-work"} dark appearance screenshot`, async ({
    page,
    baseURL,
  }) => {
    await page.context().addCookies([
      {
        name: "fss-portal-appearance",
        value: "dark",
        url: baseURL ?? "http://127.0.0.1:3219",
      },
    ]);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(`/visual/fss-studio/studio-agreement-builder${stage}`);
    await expect(
      page.getByRole("heading", { name: "Create an agreement", level: 1 }),
    ).toBeVisible();
    // Wait for the stage focus effect before removing its outline for capture.
    await expect(
      page
        .locator(
          '[aria-labelledby="staff-agreement-builder-heading"] h2[tabindex="-1"]',
        )
        .first(),
    ).toBeFocused();
    await page.evaluate(() => {
      if (document.activeElement instanceof HTMLElement)
        document.activeElement.blur();
      window.scrollTo(0, 0);
    });
    await expect(page).toHaveScreenshot(
      `guided-agreement${stage || "-work"}-dark.png`,
      { fullPage: true },
    );
  });
}

test("recurring services reach compensation choices without a temporary rate", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-agreement-builder-recurring-only");
  await page
    .getByRole("combobox", { name: "Billing interval" })
    .selectOption("1");
  await page.getByLabel(/^Rate \(£\)/).fill("");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Set ongoing compensation" }),
  ).toBeVisible();
  // Retaining fixed compensation still requires a real recurring amount on save.
  await page.getByRole("button", { name: "Save draft" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: /highlighted field/i }),
  ).toBeVisible();
  await expect(page.getByLabel(/^Rate \(£\)/)).toBeVisible();
});

test("client-proposed compensation publishes a monthly service without removing setup fees", async ({
  page,
}) => {
  const commands: Array<Record<string, unknown>> = [];
  let version = 3;
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      const command = route.request().postDataJSON();
      commands.push(command);
      if (command.action === "publish") {
        await route.fulfill({
          json: { id: "88bd0e6d-710f-40d7-9379-9d46247f2e8d" },
        });
        return;
      }
      version += 1;
      await route.fulfill({
        json: {
          content: command.content,
          id: command.draftId,
          step: command.step,
          version,
        },
      });
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-fees");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Recurring payment" })
    .selectOption("client_proposed");
  await page.getByLabel("Offer expiry").fill("2026-11-01T09:00");
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Ongoing compensation 2" }),
  ).toBeVisible();
  await expect(
    page.getByRole("combobox", { name: "Billing interval" }).nth(1),
  ).toHaveValue("1");
  await expect(page.getByLabel("Rate (£)").nth(1)).toBeDisabled();
  await expect(page.getByLabel("Discount (£)").nth(1)).toBeDisabled();
  await expect(page.getByLabel("Tax amount (£)").nth(1)).toBeDisabled();
  await page.getByLabel("Service code").nth(1).fill("support");
  await page
    .getByLabel("What this service covers")
    .nth(1)
    .fill("Ongoing support");
  await page.getByLabel("Contract start date").nth(1).fill("2026-10-01");
  await page.getByLabel("Include a one-off fee").uncheck();
  await page.getByLabel("Include a one-off fee").check();
  await expect(page.getByLabel("Service code").first()).toHaveValue("website");
  await expect(page.getByLabel("What this service covers").first()).toHaveValue(
    "Website & booking experience",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Set ongoing compensation" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Set the payment terms" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Plan the payments" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Continue to people", exact: true })
    .click();
  const feesSave = commands.find((command) => command.step === "people");
  expect(feesSave?.content).toMatchObject({
    agreement: {
      lines: [
        { recurrenceMonths: 0, unitPence: "480000" },
        { recurrenceMonths: 1, unitPence: "0" },
      ],
    },
    commercialOffer: { spec: { cash: { mode: "client_proposed" } } },
  });
  await page
    .getByRole("button", { name: "Continue to document", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Review agreement", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Send budget request", exact: true })
    .click();
  expect(commands.at(-1)).toMatchObject({
    action: "publish",
    expectedVersion: version,
  });
});

test("agreements without a one-off fee hide the schedule and omit setup lines and installments on save", async ({
  page,
}) => {
  const commands: Array<Record<string, unknown>> = [];
  let version = 3;
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      const command = route.request().postDataJSON();
      commands.push(command);
      version += 1;
      await route.fulfill({
        json: {
          content: command.content,
          id: command.draftId,
          step: command.step,
          version,
        },
      });
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-recurring-only");
  await page.getByLabel("Include a one-off fee").uncheck();
  await expect(page.getByLabel("Include a one-off fee")).not.toBeChecked();
  await expect(
    page.getByRole("combobox", { name: "Billing interval" }),
  ).toHaveValue("1");
  await page.getByLabel("Service code").fill("support");
  await page.getByLabel("What this service covers").fill("Ongoing support");
  await page.getByLabel("Rate (£)").fill("250.00");
  await page.getByLabel("Contract start date").fill("2026-09-15");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Plan the payments" }),
  ).not.toBeAttached();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await page.getByRole("button", { name: "Back", exact: true }).click();
  await expect(page.getByLabel("Service code")).toHaveValue("support");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Save draft" }).click();
  expect(commands.at(-1)?.content).toMatchObject({
    agreement: {
      installments: [],
      lines: [{ recurrenceMonths: 1, serviceCode: "support" }],
    },
  });
});

test("an incomplete saved offer explains what is missing and opens Fees to repair it", async ({
  page,
}) => {
  await page.route(
    "**/api/portal/admin/clients/*/agreement-drafts",
    async (route) => {
      const input: {
        content: AgreementBuilderDraftContent;
        draftId: string;
        step: AgreementBuilderStep;
        expectedVersion: number;
      } = route.request().postDataJSON();
      await route.fulfill({
        status: 200,
        json: {
          id: input.draftId,
          version: input.expectedVersion + 1,
          step: input.step,
          content: {
            ...input.content,
            commercialOffer: {
              spec: { cash: { mode: "client_proposed" }, revenueShare: null },
              expiresAt: "2026-11-01T00:00:00.000Z",
            },
          },
        },
      });
    },
  );
  await page.goto("/visual/fss-studio/studio-agreement-builder-review");
  await page.getByRole("button", { name: "Save draft", exact: true }).click();
  await expect(
    page.getByRole("alert").filter({
      hasText:
        "Add a recurring service, then publish the client-proposed monthly amount",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send budget request", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Edit fees", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Price the services" }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "What this service covers" }).first(),
  ).toHaveValue("Website & booking experience");
});

for (const appearance of ["light", "dark"] as const) {
  test(`ongoing compensation has clear spacing in ${appearance} appearance`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await page.context().addCookies([
      {
        name: "fss-portal-appearance",
        value: appearance,
        url: baseURL ?? "http://127.0.0.1:3219",
      },
    ]);
    await page.goto("/visual/fss-studio/studio-agreement-builder-fees");
    await page.getByRole("button", { name: "Continue", exact: true }).click();
    const heading = page.getByRole("heading", {
      name: "Set ongoing compensation",
    });
    await expect(heading).toBeFocused();
    const dropdown = page.getByRole("combobox", { name: "Recurring payment" });
    await dropdown.selectOption("client_proposed");
    const info = page.getByText("The client proposes one combined amount", {
      exact: false,
    });
    const checkbox = page.getByRole("checkbox", {
      name: "Offer revenue share for this agreement",
    });
    const dropdownBox = await dropdown.boundingBox();
    const infoBox = await info.boundingBox();
    const checkboxBox = await checkbox.boundingBox();
    expect(dropdownBox && infoBox && checkboxBox).toBeTruthy();
    if (!dropdownBox || !infoBox || !checkboxBox) return;
    expect(
      infoBox.y - dropdownBox.y - dropdownBox.height,
    ).toBeGreaterThanOrEqual(12);
    expect(checkboxBox.y - infoBox.y - infoBox.height).toBeGreaterThanOrEqual(
      12,
    );
    await heading.blur();
    await page.locator("[data-builder-group]:visible").screenshot({
      path: testInfo.outputPath(`ongoing-compensation-${appearance}.png`),
      animations: "disabled",
    });
  });
}

for (const appearance of ["light", "dark"] as const) {
  test(`saved drafts can be resumed by keyboard in ${appearance} appearance`, async ({
    page,
    baseURL,
  }, testInfo) => {
    await page.context().addCookies([
      {
        name: "fss-portal-appearance",
        value: appearance,
        url: baseURL ?? "http://127.0.0.1:3219",
      },
    ]);
    await page.goto("/visual/fss-studio/studio-agreement-drafts");
    const list = page.getByRole("region", { name: "Saved agreement drafts" });
    await expect(list).toBeVisible();
    await expect(list).toContainText("Continue at Fees");
    await expect(list).toContainText("Website & booking experience");
    const resume = list.getByRole("link", { name: "Continue draft" });
    await expect(resume).toHaveAttribute(
      "href",
      /draftId=e5d6e353-c33d-488f-9cb0-1d7b05e07050/,
    );
    await expect(
      page.getByRole("link", { name: "Start new agreement" }),
    ).toHaveAttribute("href", /new=1/);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true);
    await list.screenshot({
      path: testInfo.outputPath(`saved-agreement-drafts-${appearance}.png`),
      animations: "disabled",
    });
    await resume.focus();
    await page.keyboard.press("Enter");
    await expect(
      page.getByRole("heading", { name: "Price the services" }),
    ).toBeVisible();
    await expect(
      page.getByRole("textbox", { name: "What this service covers" }).first(),
    ).toHaveValue("Website & booking experience");
    await expect(
      page.getByRole("textbox", { name: "Rate (£)" }).first(),
    ).toHaveValue("4800.00");
  });
}

test("explicit assistive activation advances reviewed work", async ({
  page,
}) => {
  await page.goto("/visual/fss-studio/studio-agreement-builder");
  await page.getByRole("radio").first().dispatchEvent("click", { detail: 0 });
  await expect(page.locator('[data-builder-group="1"]')).toBeVisible();
});

for (const stage of ["scope", "review"] as const) {
  test(`network failures retain a distinct ${stage === "scope" ? "save" : "creation"} message`, async ({
    page,
  }) => {
    await page.route(
      "**/api/portal/admin/clients/*/agreement-drafts",
      (route) => route.abort("failed"),
    );
    await page.goto(`/visual/fss-studio/studio-agreement-builder-${stage}`);
    await page
      .getByRole("button", {
        name: stage === "scope" ? "Save draft" : "Create agreement",
        exact: true,
      })
      .click();
    await expect(
      page.getByRole("alert").filter({
        hasText:
          stage === "scope"
            ? "draft could not be saved"
            : "agreement could not be created",
      }),
    ).toBeVisible();
  });
}
