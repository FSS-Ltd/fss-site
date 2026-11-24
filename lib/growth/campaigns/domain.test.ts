import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCampaignEligibility } from "./policy";
import { assignCampaignVariant } from "./variants";
import { buildCampaignSubject, buildCampaignCopy } from "./copy";
import { campaignMonthAnniversary, londonDayKey } from "./time";
import { campaignPolicySchema, eligibilitySnapshotSchema } from "./schemas";

test("unknown permission is review and revoked approval blocks", () => {
  const policy = campaignPolicySchema.parse({ version: 1 });
  const snapshot = eligibilitySnapshotSchema.parse({ policyVersion: 1 });
  assert.equal(
    evaluateCampaignEligibility(
      { ...policy, status: "approved" },
      snapshot,
      new Date("2026-01-01"),
    ).status,
    "review",
  );
  assert.equal(
    evaluateCampaignEligibility(
      { ...policy, status: "revoked" },
      snapshot,
      new Date(),
    ).status,
    "blocked",
  );
});
test("subject uses business absent verified owner and copy makes no unverified preview claim", () => {
  assert.match(
    buildCampaignSubject({ businessName: "Acme", verifiedOwnerName: null }),
    /Acme/,
  );
  assert.throws(() =>
    buildCampaignSubject({
      businessName: "Acme\r\nBcc: x",
      verifiedOwnerName: null,
    }),
  );
  assert.doesNotMatch(
    buildCampaignCopy({
      businessName: "Acme",
      verifiedOwnerName: null,
      offer: "website_preview",
      previewReviewed: false,
      previewArtifactId: null,
      verifiedObservation: "a limited web presence",
      cta: "May I send details?",
    }).text,
    /prepared a preview/i,
  );
});
test("assignment is deterministic", () => {
  const input = {
    businessId: "b",
    market: "UK",
    seed: "s",
    variantIds: ["a", "b"] as const,
  };
  assert.equal(assignCampaignVariant(input), assignCampaignVariant(input));
});
test("London month anniversary clamps and preserves local time across DST", () => {
  assert.equal(
    campaignMonthAnniversary(new Date("2024-01-31T12:00:00Z")).toISOString(),
    "2024-02-29T12:00:00.000Z",
  );
  assert.equal(
    campaignMonthAnniversary(new Date("2025-01-31T12:00:00Z")).toISOString(),
    "2025-02-28T12:00:00.000Z",
  );
  assert.equal(
    campaignMonthAnniversary(new Date("2025-03-01T12:00:00Z")).toISOString(),
    "2025-04-01T11:00:00.000Z",
  );
  assert.equal(
    campaignMonthAnniversary(new Date("2025-10-01T11:00:00Z")).toISOString(),
    "2025-11-01T12:00:00.000Z",
  );
  assert.equal(londonDayKey(new Date("2025-03-30T23:30:00Z")), "2025-03-31");
});

test("automatic eligibility requires current approval, verified evidence, and explicit Resend opt-in", () => {
  const now = new Date("2026-02-01T12:00:00Z");
  const policy = campaignPolicySchema.parse({
    version: 1,
    status: "approved",
    approvedAt: new Date("2026-01-01"),
    approverId: "founder",
    effectiveAt: new Date("2026-01-01"),
    expiresAt: new Date("2027-01-01"),
    offer: "review",
    capabilityEvidence: "evidence",
    jurisdiction: "UK",
    permissionRequirement: "consent",
    haltThresholds: { hardBounces: 1, complaints: 1 },
    cadenceFamily: "review",
    variants: [
      { id: "a", version: 1, cta: "May I send details?" },
      { id: "b", version: 1, cta: "Would you like me to send details?" },
    ],
    provider: "resend",
  });
  const snapshot = eligibilitySnapshotSchema.parse({
    policyVersion: 1,
    sourceVerifiedAt: new Date("2026-01-15"),
    contactVerifiedAt: new Date("2026-01-15"),
    permissionEvidence: "permission",
    permissionBasis: "consent",
    permissionExpiresAt: new Date("2026-03-01"),
    permissionProvider: "resend",
    permissionJurisdiction: "UK",
    providerHealth: "healthy",
  });
  assert.equal(
    evaluateCampaignEligibility(policy, snapshot, now).status,
    "review",
  );
  assert.equal(
    evaluateCampaignEligibility(
      policy,
      {
        ...snapshot,
        explicitOptIn: true,
        permissionDetails: {
          observedAt: "2026-01-20T00:00:00Z",
          explicitOptIn: true,
          summary: "Opted in",
          reference: { kind: "private", value: "record" },
        },
      },
      now,
    ).status,
    "eligible",
  );
  const gmailPolicy = {
    ...policy,
    provider: "gmail" as const,
    jurisdiction: "GB",
  };
  const gmailSnapshot = {
    ...snapshot,
    permissionProvider: "gmail" as const,
    permissionJurisdiction: "GB",
  };
  assert.equal(
    evaluateCampaignEligibility(gmailPolicy, gmailSnapshot, now).status,
    "review",
  );
  assert.equal(
    evaluateCampaignEligibility(
      gmailPolicy,
      { ...gmailSnapshot, explicitOptIn: true },
      now,
    ).status,
    "review",
  );
  const consentDetails = {
    observedAt: "2026-01-20T00:00:00Z",
    explicitOptIn: true,
    summary: "Recipient opted in",
    reference: { kind: "private" as const, value: "record" },
  };
  assert.equal(
    evaluateCampaignEligibility(
      gmailPolicy,
      {
        ...gmailSnapshot,
        explicitOptIn: true,
        permissionDetails: consentDetails,
      },
      now,
    ).status,
    "eligible",
  );
  assert.equal(
    evaluateCampaignEligibility(
      gmailPolicy,
      {
        ...gmailSnapshot,
        explicitOptIn: true,
        permissionDetails: { ...consentDetails, explicitOptIn: false },
      },
      now,
    ).status,
    "review",
  );
  assert.equal(
    evaluateCampaignEligibility(
      gmailPolicy,
      {
        ...gmailSnapshot,
        explicitOptIn: true,
        permissionDetails: {
          ...consentDetails,
          reference: { kind: "public", value: "not-a-url" },
        },
      },
      now,
    ).status,
    "review",
  );
  assert.equal(
    evaluateCampaignEligibility(
      gmailPolicy,
      {
        ...gmailSnapshot,
        explicitOptIn: true,
        permissionDetails: {
          ...consentDetails,
          observedAt: "2027-01-01T00:00:00Z",
        },
      },
      now,
    ).status,
    "review",
  );

  assert.equal(
    evaluateCampaignEligibility(
      gmailPolicy,
      {
        ...gmailSnapshot,
        explicitOptIn: false,
        permissionDetails: {
          observedAt: "2026-01-20T00:00:00Z",
          explicitOptIn: false,
          summary: "reviewed",
          reference: { kind: "private", value: "record" },
        },
      },
      now,
    ).status,
    "review",
  );
  assert.equal(
    evaluateCampaignEligibility(
      { ...policy, permissionRequirement: "requested_service" },
      {
        ...snapshot,
        permissionBasis: "requested_service",
        explicitOptIn: true,
      },
      now,
    ).status,
    "review",
  );
  assert.equal(
    evaluateCampaignEligibility(
      {
        ...policy,
        provider: "gmail",
        jurisdiction: "GB",
        permissionRequirement: "requested_service",
      },
      {
        ...snapshot,
        permissionProvider: "gmail",
        permissionJurisdiction: "GB",
        permissionBasis: "requested_service",
      },
      now,
    ).status,
    "review",
  );
  assert.equal(
    evaluateCampaignEligibility(
      {
        ...policy,
        provider: "gmail",
        jurisdiction: "GB",
        permissionRequirement: "requested_service",
      },
      {
        ...snapshot,
        permissionProvider: "gmail",
        permissionJurisdiction: "GB",
        permissionBasis: "requested_service",
        permissionDetails: {
          observedAt: "2026-01-20T00:00:00Z",
          explicitOptIn: false,
          summary: "Recipient requested this offer and sequence.",
          reference: { kind: "private", value: "record" },
          requestedService: {
            requestedAt: "2026-01-19T00:00:00Z",
            offerId: "review",
            messageScope: "initial_and_two_followups",
            attestsRecipientRequest: true,
          },
        },
      },
      now,
    ).status,
    "eligible",
  );
  assert.equal(
    evaluateCampaignEligibility(
      policy,
      { ...snapshot, explicitOptIn: true, exclusion: "client" },
      now,
    ).status,
    "blocked",
  );
  assert.equal(
    evaluateCampaignEligibility(
      policy,
      { ...snapshot, explicitOptIn: true, permissionExpiresAt: now },
      now,
    ).status,
    "review",
  );
});

test("policy rejects invalid ramp, timezone and overnight window", () => {
  assert.equal(
    campaignPolicySchema.safeParse({ version: 1, dailyLimit: 75 }).success,
    false,
  );
  assert.equal(
    campaignPolicySchema.safeParse({
      version: 1,
      recipientTimezone: "Invalid/Zone",
    }).success,
    false,
  );
  assert.equal(
    campaignPolicySchema.safeParse({
      version: 1,
      windowStart: "17:00",
      windowEnd: "09:00",
    }).success,
    false,
  );
});

test("source leads reject private addresses, invalid countries and mismatched Facebook hosts", async () => {
  const { sourceLeadInputSchema } = await import("./schemas");
  const lead = {
    requestId: "e1f96e68-5ab6-45ff-b043-51b5fe70af90",
    sourceType: "facebook_page",
    sourceUrl: "https://facebook.com/example",
    businessName: "Acme",
    countryCode: "GB",
    corporateType: null,
    registrationNumber: null,
    firstName: null,
    lastName: null,
    email: null,
    opportunity: "Website",
    offer: "review",
    observedAt: "2026-01-01T00:00:00Z",
  };
  assert.equal(sourceLeadInputSchema.safeParse(lead).success, true);
  for (const observedAt of [
    null,
    false,
    0,
    "2026-01-01",
    "2026-02-30T00:00:00Z",
  ]) {
    assert.equal(
      sourceLeadInputSchema.safeParse({ ...lead, observedAt }).success,
      false,
    );
  }
  assert.deepEqual(
    sourceLeadInputSchema.parse(lead),
    sourceLeadInputSchema.parse({
      ...lead,
      observedAt: new Date(lead.observedAt),
    }),
  );
  assert.equal(
    sourceLeadInputSchema.safeParse({ ...lead, countryCode: "ZZ" }).success,
    false,
  );
  assert.equal(
    sourceLeadInputSchema.safeParse({ ...lead, sourceUrl: "http://127.0.0.1" })
      .success,
    false,
  );
  assert.equal(
    sourceLeadInputSchema.safeParse({
      ...lead,
      sourceUrl: "https://example.com",
    }).success,
    false,
  );
});

test("copy escapes HTML, varies only the CTA and requires an artifact for preview claims", () => {
  const input = {
    businessName: "Acme & Co",
    verifiedOwnerName: null,
    verifiedObservation: "a public listing",
    offer: "website_preview" as const,
    previewArtifactId: null,
    previewReviewed: true,
    cta: "May I send details?",
  };
  const first = buildCampaignCopy(input);
  const second = buildCampaignCopy({
    ...input,
    cta: "Would you like more details?",
  });
  assert.doesNotMatch(first.text, /prepared a reviewed preview/);
  assert.match(first.html, /Acme &amp; Co/);
  assert.equal(
    first.text.replace(
      input.cta,
      second.text.includes("Would you like more details?")
        ? "Would you like more details?"
        : "",
    ),
    second.text,
  );
  assert.match(
    buildCampaignCopy({ ...input, previewArtifactId: "artifact" }).text,
    /prepared a reviewed preview/,
  );
});

test("campaign cadence stops after two follow-ups", async () => {
  const { campaignCadenceDays } = await import("./time");
  assert.deepEqual(campaignCadenceDays("review"), [5, 10]);
  assert.deepEqual(campaignCadenceDays("facebook"), [2, 4]);
  assert.deepEqual(campaignCadenceDays("website"), [2, 4]);
});

test("campaign weekdays default to business days and reject duplicates", async () => {
  const { campaignPolicySchema } = await import("./schemas");
  assert.deepEqual(
    campaignPolicySchema.parse({ version: 1 }).sendWeekdays,
    [1, 2, 3, 4, 5],
  );
  assert.deepEqual(
    campaignPolicySchema.parse({ version: 1, sendWeekdays: [6, 7] })
      .sendWeekdays,
    [6, 7],
  );
  assert.equal(
    campaignPolicySchema.safeParse({ version: 1, sendWeekdays: [1, 1] })
      .success,
    false,
  );
  assert.equal(
    campaignPolicySchema.safeParse({ version: 1, sendWeekdays: [] }).success,
    false,
  );
  assert.equal(
    campaignPolicySchema.safeParse({ version: 1, sendWeekdays: [8] }).success,
    false,
  );
});

test("campaign policy retains an explicit Gmail account binding", async () => {
  const { campaignPolicySchema } = await import("./schemas");
  const accountConnectionId = "00000000-0000-4000-8000-000000000001";
  const result = campaignPolicySchema.parse({
    version: 1,
    accountConnectionId,
  });
  assert.equal(Reflect.get(result, "accountConnectionId"), accountConnectionId);
});

test("campaign commands reject the retired campaign-scoped ramp operation", async () => {
  const { campaignCommandSchema } = await import("./schemas");
  assert.equal(
    campaignCommandSchema.safeParse({
      type: "raise_limit",
      requestId: "00000000-0000-4000-8000-000000000001",
      campaignId: "00000000-0000-4000-8000-000000000002",
      policyVersion: 1,
      limit: 50,
    }).success,
    false,
  );
});

test("public source URLs reject normalized IP hosts", async () => {
  const { sourceLeadInputSchema } = await import("./schemas");
  const schema = sourceLeadInputSchema.shape.sourceUrl;
  for (const value of [
    "http://127.0.0.1",
    "http://2130706433",
    "http://0x7f000001",
    "http://0177.0.0.1",
    "http://[::1]",
    "http://[::ffff:127.0.0.1]",
    "http://example.localhost",
    "http://example.local",
  ]) {
    assert.equal(schema.safeParse(value).success, false, value);
  }
  assert.equal(schema.safeParse("https://example.org/path").success, true);
});

test("public source URL validation retains DNS and URL boundary behavior", async () => {
  const { sourceLeadInputSchema } = await import("./schemas");
  const schema = sourceLeadInputSchema.shape.sourceUrl;
  const cases: [string, boolean][] = [
    ["https://example.org/path", true],
    ["http://sub.example.org", true],
    ["https://user:pass@example.org", false],
    ["ftp://example.org", false],
    ["https://localhost", false],
    ["https://example.localhost", false],
    ["https://example.local", false],
    ["https://example.localhost.org", true],
    ["https://example.internal", true],
  ];
  for (const [url, expected] of cases)
    assert.equal(schema.safeParse(url).success, expected, url);
});
