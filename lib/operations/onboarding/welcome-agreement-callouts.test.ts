import assert from "node:assert/strict";
import test from "node:test";
import { createDesignedWelcomePack } from "./packet-editions";
import { resolveWelcomePack } from "./welcome-personalisation";
import { welcomeFixtureInput } from "./fixtures";
import { prepareWelcome } from "./approval";
import {
  prefillWelcomeSummary,
  withWelcomeAgreementCallouts,
  welcomeSummarySchema,
} from "./welcome-agreement-callouts";
import { welcomePackContentSchema } from "./welcome-pack-contract";

test("prefills only a complete short agreement paragraph", () => {
  assert.equal(
    prefillWelcomeSummary(
      "Build the booking website.\n\nAdditional terms follow.",
    ),
    "Build the booking website.",
  );
  assert.equal(prefillWelcomeSummary("Long ".repeat(60)), "");
  assert.equal(prefillWelcomeSummary("Scope \u2014 with an em dash"), "");
  assert.equal(welcomeSummarySchema.safeParse(" ").success, false);
});

test("every designed edition includes concise callouts once without changing its published copy", () => {
  for (const edition of [
    "website_build",
    "website_seo",
    "systems_portal",
  ] as const) {
    const base = createDesignedWelcomePack(edition);
    const personalised = withWelcomeAgreementCallouts(base, {
      scopeSummary: "Website and booking",
      responsibilitiesSummary: "Supply content and one reviewer",
    });
    assert.equal(welcomePackContentSchema.parse(personalised).guide.length, 9);
    assert.equal(
      personalised.guide.filter((page) =>
        page.paragraphs.some((text) =>
          text.includes("Proposed scope in brief:"),
        ),
      ).length,
      1,
    );
    assert.equal(
      personalised.guide.filter((page) =>
        page.paragraphs.some((text) =>
          text.includes("Your part in the proposed work:"),
        ),
      ).length,
      1,
    );
    assert.ok(
      !JSON.stringify(base).includes("Supply content and one reviewer"),
    );
    assert.ok(!base.emailBody.includes("{{agreement_scope}}"));
  }
});

test("reviewed summaries fit the PDF and match the accessible reading view", async () => {
  for (const edition of [
    "website_build",
    "website_seo",
    "systems_portal",
  ] as const) {
    const base = resolveWelcomePack(
      createDesignedWelcomePack(edition),
      {
        client_name: "Northstar",
        contact_first_name: "Alex",
        agreement_goal: "A clearer client experience",
        sender_name: "Jean-Fidele",
      },
      48,
    );
    const packet = withWelcomeAgreementCallouts(base, {
      scopeSummary: "S".repeat(200),
      responsibilitiesSummary: "R".repeat(200),
    });
    const input = welcomeFixtureInput();
    const prepared = await prepareWelcome({
      ...input,
      content: {
        ...input.content,
        rendererVersion: 2,
        edition,
        pages: packet.guide,
      },
    });
    assert.match(prepared.snapshot.accessibleHtml, /S{200}/);
    assert.match(prepared.snapshot.accessibleHtml, /R{200}/);
    assert.equal(
      (prepared.pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
      10,
    );
  }
});
