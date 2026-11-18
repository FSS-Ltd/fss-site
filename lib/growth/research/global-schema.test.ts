import assert from "node:assert/strict";
import test from "node:test";
import { globalResearchRunSchema } from "./global-schema";
import { createGlobalResearchFixture } from "./global-test-fixture";

test("global research admits a public business mailbox without registration or invented names", () => {
  const run = globalResearchRunSchema.parse(createGlobalResearchFixture());
  assert.equal(run.prospects[0]?.business.countryCode, "CA");
  assert.equal(run.prospects[0]?.business.companyNumber, null);
  assert.equal(run.prospects[0]?.contact.firstName, null);
  assert.equal(run.prospects[0]?.prospect.estimatedOneOffMinPence, 0);
});

test("global research rejects unsupported email provenance and unsafe or mismatched copy", () => {
  const fixture = createGlobalResearchFixture();
  const candidate = fixture.prospects[0]!;
  for (const firstEmail of [
    { ...candidate.firstEmail, html: "<script>alert(1)</script>" },
    { ...candidate.firstEmail, html: "<p>Different copy.</p>" },
    { ...candidate.firstEmail, wordCount: 200 },
  ]) {
    assert.equal(
      globalResearchRunSchema.safeParse({
        ...fixture,
        prospects: [{ ...candidate, firstEmail }],
      }).success,
      false,
    );
  }
  candidate.contact.emailSourceUrl = "https://unrelated.test/contact";
  assert.equal(globalResearchRunSchema.safeParse(fixture).success, false);
});

test("global research requires valid country, recorded evidence and at most ten candidates", () => {
  const fixture = createGlobalResearchFixture();
  assert.equal(
    globalResearchRunSchema.safeParse({
      ...fixture,
      prospects: Array(11).fill(fixture.prospects[0]),
    }).success,
    false,
  );
  fixture.prospects[0]!.business.countryCode = "ZZ";
  assert.equal(globalResearchRunSchema.safeParse(fixture).success, false);
});

test("malformed URLs return validation issues rather than throwing", () => {
  const fixture = createGlobalResearchFixture();
  fixture.prospects[0]!.business.firstPartySourceUrl = "not a url";
  assert.equal(globalResearchRunSchema.safeParse(fixture).success, false);
});

test("Maps references must use Maps hosts and discovery-only claims", () => {
  const fixture = createGlobalResearchFixture();
  const invalid = {
    ...fixture.prospects[0]!.business,
    googlePlaceId: "abc",
    googleMapsReferenceUrl: "https://attacker.test/maps",
  };
  assert.equal(
    globalResearchRunSchema.safeParse({
      ...fixture,
      prospects: [{ ...fixture.prospects[0], business: invalid }],
    }).success,
    false,
  );
});

test("accepts short reviewed copy and a natural-language opt-out", () => {
  const fixture = createGlobalResearchFixture();
  const email = fixture.prospects[0]!.firstEmail;
  email.text =
    "A booking portal could help. If you would rather I did not contact you again, reply and I will leave it there.";
  email.html = `<p>${email.text}</p>`;
  email.wordCount = email.text.split(/\s+/).length;
  email.optOutSentence =
    "If you would rather I did not contact you again, reply and I will leave it there.";
  assert.equal(globalResearchRunSchema.safeParse(fixture).success, true);
});

test("accepts only a distinct, source-bound research proof pair", () => {
  const fixture = createGlobalResearchFixture();
  const candidate = fixture.prospects[0]!;
  const contact = { ...candidate.evidence[0]!, claimType: "contact_email" };
  const observation = {
    ...candidate.evidence[0]!,
    claimType: "business_observation",
    claimSummary: "Customers request appointments by telephone.",
  };
  const proof = {
    purpose: "campaign_source_proof",
    contactEmail: { evidenceIndex: 0, email: candidate.contact.email },
    businessObservation: { evidenceIndex: 1 },
  };
  const withProof = {
    ...fixture,
    prospects: [{ ...candidate, evidence: [contact, observation], proof }],
  };
  assert.equal(globalResearchRunSchema.safeParse(withProof).success, true);
  assert.equal(
    globalResearchRunSchema.safeParse({
      ...withProof,
      prospects: [
        {
          ...withProof.prospects[0],
          proof: { ...proof, businessObservation: { evidenceIndex: 0 } },
        },
      ],
    }).success,
    false,
  );
  assert.equal(
    globalResearchRunSchema.safeParse({
      ...withProof,
      prospects: [
        {
          ...withProof.prospects[0],
          proof: {
            ...proof,
            contactEmail: { evidenceIndex: 0, email: "wrong@example.test" },
          },
        },
      ],
    }).success,
    false,
  );
  const registry = {
    ...candidate,
    business: { ...candidate.business, companyNumber: "12345678" },
    evidence: [
      contact,
      {
        ...observation,
        sourceType: "business_registry",
        sourceUrl: "https://registry.example.test/12345678",
        externalReference: "12345678",
      },
    ],
    proof,
  };
  assert.equal(
    globalResearchRunSchema.safeParse({ ...fixture, prospects: [registry] })
      .success,
    false,
  );
  const social = {
    ...candidate,
    business: {
      ...candidate.business,
      websiteUrl: "https://facebook.com/business-a",
      firstPartySourceUrl: "https://facebook.com/business-a",
    },
    contact: {
      ...candidate.contact,
      emailSourceUrl: "https://facebook.com/business-b",
    },
    evidence: [
      { ...contact, sourceUrl: "https://facebook.com/business-b" },
      { ...observation, sourceUrl: "https://facebook.com/business-b" },
    ],
    proof,
  };
  assert.equal(
    globalResearchRunSchema.safeParse({ ...fixture, prospects: [social] })
      .success,
    false,
  );
  const sharedUrl = "https://shared.wixsite.com/business-a";
  const shared = {
    ...candidate,
    business: {
      ...candidate.business,
      websiteUrl: sharedUrl,
      firstPartySourceUrl: sharedUrl,
    },
    contact: { ...candidate.contact, emailSourceUrl: sharedUrl },
    evidence: [
      { ...contact, sourceUrl: sharedUrl },
      { ...observation, sourceUrl: sharedUrl },
    ],
    proof,
  };
  assert.equal(
    globalResearchRunSchema.safeParse({ ...fixture, prospects: [shared] })
      .success,
    false,
  );
  for (const unsafe of [
    "http://127.0.0.1/contact",
    "http://0x7f000001/contact",
    "http://[::1]/contact",
    "https://user:pass@example.test/contact",
  ]) {
    const changed = {
      ...candidate,
      business: {
        ...candidate.business,
        websiteUrl: unsafe,
        firstPartySourceUrl: unsafe,
      },
      contact: { ...candidate.contact, emailSourceUrl: unsafe },
      evidence: [
        { ...contact, sourceUrl: unsafe },
        { ...observation, sourceUrl: unsafe },
      ],
      proof,
    };
    assert.equal(
      globalResearchRunSchema.safeParse({ ...fixture, prospects: [changed] })
        .success,
      false,
    );
  }
});
