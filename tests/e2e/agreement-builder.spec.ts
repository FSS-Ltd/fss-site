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
  await page.goto("/visual/fss-studio/studio-agreement-builder-fees");
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
    page.getByRole("heading", { name: "Price the services" }),
  ).toBeFocused();
  await expect(
    page.getByRole("alert").filter({ hasText: /amount/i }),
  ).toBeVisible();
});

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
      hasText: "Client-proposed amounts apply to recurring services",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Publish payment offer", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Edit fees", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Price the services" }),
  ).toBeFocused();
  await expect(
    page.getByRole("textbox", { name: "Description" }).first(),
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
