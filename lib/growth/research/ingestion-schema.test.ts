import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { parseResearchRunIngestion } from "./ingestion-schema";
import { createValidResearchRunFixture as createValidFixture } from "./ingestion-schema.test-fixture";
import { MAX_RESEARCH_BUNDLE_BYTES } from "./limits";

function createEvidenceBackedFixture() {
  const fixture = createValidFixture();
  const candidate = fixture.prospects[0]!;

  return {
    ...fixture,
    schemaVersion: "1.1" as const,
    prospects: [
      {
        ...candidate,
        brandEvidence: [
          {
            id: "00000000-0000-4000-8000-000000000001",
            kind: "service-language" as const,
            sourceUrl: "https://example.test/services",
            evidenceText: "MOT, servicing and repairs for local drivers.",
            observedAt: "2026-08-17T05:25:00.000Z",
          },
          {
            id: "00000000-0000-4000-8000-000000000002",
            kind: "brand-colours" as const,
            sourceUrl: "https://example.test",
            evidenceText: "#19374A",
            observedAt: "2026-08-17T05:25:00.000Z",
          },
        ],
        assessment: {
          ...candidate.assessment,
          experienceBrief: {
            schemaVersion: "1.1" as const,
            hero: {
              statement:
                "Start your MOT, service or repair request with your registration.",
              supportingStatement:
                "Example Services can prepare the workshop conversation with the right vehicle details.",
              evidenceIds: ["00000000-0000-4000-8000-000000000001"],
            },
            journey: {
              title: "Get your vehicle ready for the workshop",
              primaryCta: "Start with your registration",
              completionMessage: "Your workshop request is ready to review.",
              steps: [
                {
                  id: "vehicle",
                  label: "Tell us about your vehicle",
                  kind: "vehicle-registration" as const,
                  control: "registration" as const,
                  requiredFields: ["registration" as const],
                  options: [],
                },
                {
                  id: "review",
                  label: "Review your request",
                  kind: "review" as const,
                  control: "review" as const,
                  requiredFields: [],
                  options: [],
                },
              ],
            },
            visual: {
              brandColors: ["#19374A"],
              colourEvidenceIds: ["00000000-0000-4000-8000-000000000002"],
              logoEvidenceId: null,
              logoAssetId: null,
              onSiteImageEvidenceId: null,
              onSiteImageAssetId: null,
              approvedHeroMediaAssetId: null,
            },
          },
        },
      },
    ],
  };
}

test("accepts one complete versioned research bundle", () => {
  const parsed = parseResearchRunIngestion(createValidFixture());

  assert.equal(parsed.schemaVersion, "1.0");
  assert.equal(parsed.prospects[0]?.business.county, "Kent");
  assert.equal(parsed.prospects[0]?.prospect.fitScore, 91);
});

test("requires evidence-backed preview briefs for weekday research runs", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        externalRunId: "weekday-2026-08-28-0600-europe-london-v1",
      }),
    /evidence-backed preview research requires/i,
  );
});

test("requires first-party evidence for an evidence-backed preview brief", () => {
  const parsed = parseResearchRunIngestion(createEvidenceBackedFixture());

  assert.equal(parsed.schemaVersion, "1.1");
  assert.equal(
    parsed.prospects[0]?.assessment.experienceBrief?.journey.steps[0]?.control,
    "registration",
  );

  const invalid = createEvidenceBackedFixture();
  invalid.prospects[0]!.brandEvidence[0]!.sourceUrl =
    "https://maps.google.com/?cid=123";

  assert.throws(
    () => parseResearchRunIngestion(invalid),
    /first-party preview evidence/i,
  );
});

test("requires a source-backed initial-email narrative", () => {
  const fixture = createValidFixture();
  const candidate = { ...fixture.prospects[0] };
  Reflect.deleteProperty(candidate, "emailNarrative");

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [candidate],
      }),
    /emailNarrative/i,
  );
});

test("rejects an initial-email narrative sourced from non-first-party evidence", () => {
  const fixture = createValidFixture();
  const candidate = structuredClone(fixture.prospects[0]!);
  candidate.emailNarrative.openingStrength.evidenceSourceUrl =
    candidate.evidence[0]!.sourceUrl;

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [candidate],
      }),
    /first-party evidence/i,
  );
});

test("accepts escaped HTML-sensitive email standards", () => {
  const fixture = createValidFixture();
  const candidate = fixture.prospects[0];
  const optOutSentence =
    "Reply opt out if R&D <isn't relevant> and you prefer no further emails.";
  const conceptDisclaimer =
    "Concept image for R&D <discussion> only, not a finished design.";
  const body = candidate.firstEmail.text.split("\n\n")[0];
  const text = `${body}\n\n${conceptDisclaimer}\n\n${optOutSentence}`;
  const html = `<p>${body}</p><p>Concept image for R&amp;D &lt;discussion&gt; only, not a finished design.</p><p>Reply opt out if R&amp;D &lt;isn&#39;t relevant&gt; and you prefer no further emails.</p>`;

  const parsed = parseResearchRunIngestion({
    ...fixture,
    prospects: [
      {
        ...candidate,
        firstEmail: {
          ...candidate.firstEmail,
          html,
          text,
          wordCount: text.trim().split(/\s+/).length,
          optOutSentence,
          conceptDisclaimer,
        },
        visual: { ...candidate.visual, conceptDisclaimer },
      },
    ],
  });

  assert.equal(
    parsed.prospects[0]?.firstEmail.conceptDisclaimer,
    conceptDisclaimer,
  );
});

test("accepts the redacted operator fixture", () => {
  const fixture = JSON.parse(
    readFileSync("docs/growth-os/fixtures/research-run-v1.json", "utf8"),
  ) as unknown;

  const parsed = parseResearchRunIngestion(fixture);
  const fixtureStrings: string[] = [];
  JSON.stringify(fixture, (_key, value: unknown) => {
    if (typeof value === "string") {
      fixtureStrings.push(value);
    }
    return value;
  });
  const urls = fixtureStrings.filter((value) => /^https?:\/\//.test(value));
  const emails = fixtureStrings.filter((value) =>
    /^[^\s@]+@[^\s@]+$/.test(value),
  );

  assert.match(parsed.externalRunId, /^dry-run-/);
  assert.equal(parsed.prospects[0]?.contact.email.endsWith(".test"), true);
  assert.equal(parsed.prospects[0]?.visual.assetId, null);
  assert.equal(
    emails.every((email) => email.endsWith(".test")),
    true,
  );
  assert.equal(
    urls.every((value) => {
      const hostname = new URL(value).hostname;
      return (
        hostname.endsWith(".test") ||
        hostname === "find-and-update.company-information.service.gov.uk"
      );
    }),
    true,
  );
});

test("rejects a canonical bundle above the route byte ceiling", () => {
  const fixture = createValidFixture();
  const oversizedSection = {
    schemaVersion: "1.0" as const,
    summary: "Maximum escaped assessment",
    items: Array.from({ length: 30 }, () => "\0".repeat(1000)),
  };
  const candidate = fixture.prospects[0];
  const oversizedCandidate = {
    ...candidate,
    assessment: Object.fromEntries(
      Object.keys(candidate.assessment).map((name) => [
        name,
        name === "businessGoal"
          ? candidate.assessment.businessGoal
          : name === "primaryCta"
            ? candidate.assessment.primaryCta
            : oversizedSection,
      ]),
    ),
  };
  const oversized = {
    ...fixture,
    prospects: Array.from({ length: 10 }, () => oversizedCandidate),
  };

  assert.ok(
    new TextEncoder().encode(JSON.stringify(oversized)).byteLength >
      MAX_RESEARCH_BUNDLE_BYTES,
  );
  assert.throws(() => parseResearchRunIngestion(oversized), /serialized size/i);
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
        reasonCode: "personal_subscriber",
        sourceUrl: "https://example.test",
      },
    ],
  });

  assert.equal(parsed.prospects.length, 0);
  assert.equal(parsed.rejections.length, 1);
});

test("rejects an uncontrolled rejection reason code", () => {
  const fixture = createValidFixture();

  assert.throws(
    () =>
      parseResearchRunIngestion({
        ...fixture,
        prospects: [],
        rejections: [
          {
            candidateName: "Unclear Example",
            reasonCode: "miscellaneous",
          },
        ],
      }),
    /supported rejection reason code/i,
  );
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
