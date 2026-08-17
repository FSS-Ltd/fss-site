import assert from "node:assert/strict";
import test from "node:test";

import { parseResearchRunIngestion } from "./ingestion-schema";
import { createValidResearchRunFixture as createValidFixture } from "./ingestion-schema.test-fixture";

test("accepts one complete versioned research bundle", () => {
  const parsed = parseResearchRunIngestion(createValidFixture());

  assert.equal(parsed.schemaVersion, "1.0");
  assert.equal(parsed.prospects[0]?.business.county, "Kent");
  assert.equal(parsed.prospects[0]?.prospect.fitScore, 91);
});

test("requires custom visuals to be uploaded after prospect IDs exist", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            visual: {
              ...fixture.prospects[0].visual,
              assetId: "55555555-5555-4555-8555-555555555555",
            },
          },
        ],
      }),
    /uploaded after/i,
  );
});

test("rejects the wrong schema version", () => {
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...createValidFixture(),
        schemaVersion: "2.0",
      }),
    /schema version/i,
  );
});

test("rejects a business outside Kent", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            business: { ...fixture.prospects[0].business, county: "Essex" },
          },
        ],
      }),
    /Kent/i,
  );
});

test("rejects a sole trader or non-corporate subscriber", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            business: {
              ...fixture.prospects[0].business,
              corporateType: "sole_trader",
            },
          },
        ],
      }),
    /corporate type/i,
  );
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            contact: {
              ...fixture.prospects[0].contact,
              subscriberType: "individual",
            },
          },
        ],
      }),
    /corporate subscriber/i,
  );
});

test("rejects an inactive company", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            business: {
              ...fixture.prospects[0].business,
              corporateStatus: "inactive",
            },
          },
        ],
      }),
    /active company/i,
  );
});

test("rejects a bundle without Companies House evidence", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            evidence: fixture.prospects[0].evidence.filter(
              (evidence) => evidence.sourceType !== "companies_house",
            ),
          },
        ],
      }),
    /Companies House evidence/i,
  );
});

test("rejects unapproved Google Maps content fields", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            business: {
              ...fixture.prospects[0].business,
              googleRating: 4.9,
            },
          },
        ],
      }),
    /unrecognized key/i,
  );
});

test("rejects Google Maps content hidden in evidence fields", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            evidence: [
              ...fixture.prospects[0].evidence,
              {
                sourceType: "google_maps_reference",
                sourceUrl: "https://maps.google.com/?cid=123",
                externalReference: "place-123",
                claimType: "rating",
                claimSummary: "Rated 4.9 from copied customer reviews.",
                observedAt: "2026-08-17T05:25:00.000Z",
                verifiedAt: "2026-08-17T05:25:00.000Z",
                retentionClass: "prospect_research",
              },
            ],
          },
        ],
      }),
    /discovery reference only/i,
  );
});

test("rejects a personal mailbox from automated ingestion", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            contact: {
              ...fixture.prospects[0].contact,
              email: "example.owner@gmail.com",
              mailboxType: "personal",
            },
          },
        ],
      }),
    /manual review/i,
  );
});

test("rejects missing opt-out copy", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            firstEmail: {
              ...fixture.prospects[0].firstEmail,
              optOutSentence: "",
            },
          },
        ],
      }),
    /opt-out/i,
  );
});

test("rejects a missing image disclaimer or alt text", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            visual: { ...fixture.prospects[0].visual, conceptDisclaimer: "" },
          },
        ],
      }),
    /concept disclaimer/i,
  );
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            visual: { ...fixture.prospects[0].visual, altText: "" },
          },
        ],
      }),
    /alt text/i,
  );
});

test("rejects a fit score outside zero through one hundred", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            prospect: { ...fixture.prospects[0].prospect, fitScore: 101 },
          },
        ],
      }),
    /fit score/i,
  );
});

test("rejects a bundle without first-party opportunity evidence", () => {
  const fixture = createValidFixture();
  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            evidence: fixture.prospects[0].evidence.filter(
              (evidence) => evidence.sourceType !== "first_party",
            ),
          },
        ],
      }),
    /first-party evidence/i,
  );
});

test("accepts a run containing only recorded rejections", () => {
  const fixture = createValidFixture();
  const parsed = parseResearchRunIngestion({
    ...fixture,
    prospects: [],
    rejections: [
      {
        candidateName: "Example Sole Trader",
        reasonCode: "individual_subscriber",
        sourceUrl: "https://example.test",
      },
    ],
  });

  assert.equal(parsed.prospects.length, 0);
  assert.equal(parsed.rejections.length, 1);
});

test("rejects an empty run with no accepted or rejected candidate", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [],
        rejections: [],
      }),
    /at least one candidate/i,
  );
});

test("rejects a declared email word count that does not match the text", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            firstEmail: {
              ...fixture.prospects[0].firstEmail,
              wordCount: fixture.prospects[0].firstEmail.wordCount - 1,
            },
          },
        ],
      }),
    /word count must match/i,
  );
});

test("rejects Companies House evidence for another company number", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            evidence: fixture.prospects[0].evidence.map((evidence) =>
              evidence.sourceType === "companies_house"
                ? { ...evidence, externalReference: "87654321" }
                : evidence,
            ),
          },
        ],
      }),
    /company number/i,
  );
});

test("rejects every Companies House URL for another company profile", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            evidence: [
              ...fixture.prospects[0].evidence,
              {
                ...fixture.prospects[0].evidence[0],
                sourceUrl:
                  "https://find-and-update.company-information.service.gov.uk/company/99999999",
              },
            ],
          },
        ],
      }),
    /profile URL.*company number/i,
  );
});

test("rejects non-HTTP source URLs", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            business: {
              ...fixture.prospects[0].business,
              googleMapsReferenceUrl: "javascript:alert(1)",
            },
          },
        ],
      }),
    /HTTP or HTTPS/i,
  );
});

test("rejects a Google Maps reference from another host", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            business: {
              ...fixture.prospects[0].business,
              googleMapsReferenceUrl: "https://example.test/maps/123",
            },
          },
        ],
      }),
    /Google Maps reference URL/i,
  );
});

test("reports a validation error for a malformed Google Maps URL", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            business: {
              ...fixture.prospects[0].business,
              googleMapsReferenceUrl: "not-url",
            },
          },
        ],
      }),
    /valid source URL/i,
  );
});

test("reports a validation error for a malformed Companies House URL", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            evidence: fixture.prospects[0].evidence.map((evidence) =>
              evidence.sourceType === "companies_house"
                ? { ...evidence, sourceUrl: "not-url" }
                : evidence,
            ),
          },
        ],
      }),
    /valid source URL/i,
  );
});

test("rejects executable HTML in a first-email candidate", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            firstEmail: {
              ...fixture.prospects[0].firstEmail,
              html: `${fixture.prospects[0].firstEmail.html}<script>alert(1)</script>`,
            },
          },
        ],
      }),
    /safe email HTML allowlist/i,
  );
});

test("rejects active HTML outside the email allowlist", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            firstEmail: {
              ...fixture.prospects[0].firstEmail,
              html: `${fixture.prospects[0].firstEmail.html}<meta http-equiv="refresh" content="0;url=data:text/html,unsafe">`,
            },
          },
        ],
      }),
    /safe email HTML allowlist/i,
  );
});

test("rejects evidence summaries beyond the contract limit", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            evidence: fixture.prospects[0].evidence.map((evidence, index) =>
              index === 0
                ? { ...evidence, claimSummary: "x".repeat(2001) }
                : evidence,
            ),
          },
        ],
      }),
    /claim summary/i,
  );
});

test("rejects a claimed work email on an unrelated domain", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            contact: {
              ...fixture.prospects[0].contact,
              email: "alex@unrelated-business.test",
            },
          },
        ],
      }),
    /work email domain/i,
  );
});

test("rejects first-party evidence from an unrelated host", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [
          {
            ...fixture.prospects[0],
            evidence: fixture.prospects[0].evidence.map((evidence) =>
              evidence.sourceType === "first_party"
                ? { ...evidence, sourceUrl: "https://unrelated.test/services" }
                : evidence,
            ),
          },
        ],
      }),
    /first-party evidence host/i,
  );
});
