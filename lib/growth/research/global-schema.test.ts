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
