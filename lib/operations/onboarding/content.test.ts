import { test } from "node:test";
import assert from "node:assert/strict";
import {
  prepareWelcome,
  prepareProposal,
  validatePreparedWelcome,
} from "./approval";
import { preparedWelcomeFixture, welcomeFixtureInput } from "./fixtures";
import { thankYouEmail } from "./content/thank-you";
import { onboardingEnabled, getOnboardingWorkerDb } from "./worker-db";
test("five page accessible welcome freezes recipient, sender and PDF without promotional copy", async () => {
  const p = await preparedWelcomeFixture();
  validatePreparedWelcome(p);
  assert.equal(p.pdf.subarray(0, 5).toString(), "%PDF-");
  assert.ok(p.pdf.length < 2097152);
  assert.equal(
    (p.pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
    5,
  );
  for (const page of p.snapshot.content.pages) {
    assert.ok(p.snapshot.accessibleHtml.includes(page.title));
    for (const paragraph of page.paragraphs)
      assert.ok(p.snapshot.welcome.text.includes(paragraph));
  }
  assert.doesNotMatch(
    p.snapshot.welcome.text,
    /newsletter|subscribe|in two hours|contract is signed/i,
  );
  assert.equal(p.snapshot.welcome.from, "service@example.test");
  p.snapshot.welcome.subject = "changed";
  assert.throws(() => validatePreparedWelcome(p));
});
test("unsupported fonts, missing fields and overflowing pages block approval", async () => {
  const input = welcomeFixtureInput();
  await assert.rejects(
    prepareWelcome({ ...input, content: { ...input.content, senderName: "" } }),
  );
  await assert.rejects(
    prepareWelcome({
      ...input,
      content: { ...input.content, senderName: "名前" },
    }),
  );
  await assert.rejects(
    prepareWelcome({
      ...input,
      content: {
        ...input.content,
        pages: input.content.pages.map((page) => ({
          ...page,
          paragraphs: Array(8).fill("Long content. ".repeat(120)),
        })),
      },
    }),
  );
});
test("proposal uses the canonical signing link and separately approved access marker", async () => {
  const { snapshot } = await preparedWelcomeFixture();
  const input = {
    signingApprovalId: "10000000-0000-4000-8000-000000000001",
    approvalHash: "a".repeat(64),
    revision: 1,
    signers: ["signer0@example.test"],
    access: [{ email: "signer0@example.test", role: "owner" as const }],
    portalUrl: "https://example.test/agreements",
    scopeSummary: "the approved board",
  };
  const p = prepareProposal(input, snapshot);
  assert.ok(p.emails[0].text.includes(input.portalUrl));
  assert.ok(p.emails[0].html.includes(`<a href="${input.portalUrl}"`));
  assert.equal(
    prepareProposal(
      { ...input, portalUrl: "https://example.test/portal/agreements" },
      snapshot,
    ).portalUrl,
    "https://example.test/portal/agreements",
  );
  assert.ok(p.emails[0].html.includes('href="{{portal_access_url}}"'));
  assert.ok(p.emails[0].text.includes("{{portal_access_url}}"));
  assert.throws(() =>
    prepareProposal(
      { ...input, portalUrl: input.portalUrl + "?token=private" },
      snapshot,
    ),
  );
  assert.throws(() =>
    prepareProposal(
      { ...input, signers: [...input.signers, ...input.signers] },
      snapshot,
    ),
  );
  const thanks = thankYouEmail(
    snapshot,
    "https://example.test/billing",
    "https://example.test/",
  );
  assert.match(thanks.text, /first invoice is ready/);
  assert.doesNotMatch(thanks.text, /newsletter|subscribe/i);
});
test("worker remains disabled unless both Operations gates are true", () => {
  assert.equal(onboardingEnabled({ OPERATIONS_ENABLED: "true" }), false);
  assert.equal(
    onboardingEnabled({
      OPERATIONS_ENABLED: "true",
      OPERATIONS_ONBOARDING_ENABLED: "true",
    }),
    true,
  );
  const prior = process.env.OPERATIONS_ONBOARDING_ENABLED;
  delete process.env.OPERATIONS_ONBOARDING_ENABLED;
  try {
    assert.throws(() => getOnboardingWorkerDb(), /disabled/);
  } finally {
    if (prior !== undefined) process.env.OPERATIONS_ONBOARDING_ENABLED = prior;
  }
});
