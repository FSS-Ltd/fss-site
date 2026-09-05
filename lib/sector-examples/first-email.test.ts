import assert from "node:assert/strict";
import test from "node:test";
import { examplesForSector, sectorExamples } from "./catalog";
import { renderSectorExampleFirstEmail } from "./first-email";
import { createValidResearchRunFixture } from "../growth/research/ingestion-schema.test-fixture";
import { parseFirstEmailCandidate } from "../growth/research/ingestion-schema";

const candidate = createValidResearchRunFixture().prospects[0]!;
const input = {
  subject: candidate.firstEmail.subject,
  narrative: candidate.emailNarrative,
  optOutSentence: candidate.firstEmail.optOutSentence,
  conceptDisclaimer: candidate.firstEmail.conceptDisclaimer,
  siteUrl: "https://faithfulsoftware.dev",
  sector: "Roofing",
};

test("matches relevant examples without offering a different sector as an exact match", () => {
  for (const [sector, theme] of [
    ["roofing contractors", "roof"],
    ["Estate Agents", "estate"],
    ["lettings", "estate"],
    ["motor garage", "auto"],
    ["accountancy", "accounts"],
  ])
    assert.equal(examplesForSector(sector)[0]?.theme, theme);
  assert.deepEqual(examplesForSector("Dentistry"), []);
  assert.deepEqual(examplesForSector("Home and property services"), []);
});
test("renders a valid, linked, honestly described sector example email", () => {
  const email = renderSectorExampleFirstEmail(input);
  assert.match(email.text, /Ridge & Vale/);
  assert.match(email.text, /four interactive examples/);
  assert.match(email.text, /fictional companies/);
  assert.equal(
    (
      email.html.match(
        /<a href="https:\/\/faithfulsoftware.dev\/examples\//g,
      ) ?? []
    ).length,
    4,
  );
  assert.doesNotMatch(email.text, /built a private example/);
  assert.match(
    email.html,
    /<a href="https:\/\/faithfulsoftware.dev\/examples\/ridge-and-vale">/,
  );
  assert.deepEqual(parseFirstEmailCandidate(email), email);
});
test("preserves an existing private concept alongside the sector example", () => {
  const email = renderSectorExampleFirstEmail({
    ...input,
    previewUrl: "https://faithfulsoftware.dev/preview/existing-company",
  });
  assert.match(email.text, /\/preview\/existing-company/);
  assert.match(email.text, /\/examples\/ridge-and-vale/);
  assert.deepEqual(parseFirstEmailCandidate(email), email);
});
test("uses an honestly labelled collection for unsupported sectors", () => {
  const email = renderSectorExampleFirstEmail({
    ...input,
    sector: "Dentistry",
  });
  assert.match(email.text, /across other service sectors/);
  assert.match(email.text, /https:\/\/faithfulsoftware.dev\/examples/);
  assert.deepEqual(parseFirstEmailCandidate(email), email);
});
test("rejects unsafe origins and concept URLs", () => {
  assert.throws(() =>
    renderSectorExampleFirstEmail({ ...input, siteUrl: "javascript:alert(1)" }),
  );
  assert.throws(() =>
    renderSectorExampleFirstEmail({
      ...input,
      previewUrl: "javascript:alert(1)",
    }),
  );
});

test("all ten sectors have four linked examples within the email word limit", () => {
  assert.equal(sectorExamples.length, 40);
  const sectors = [
    "Roofing",
    "Estate agency",
    "Accountancy",
    "Automotive",
    "Plumbing",
    "Electrical",
    "Hospitality",
    "Landscape design",
    "Office supplies",
    "Workshop equipment",
  ];
  for (const sector of sectors) {
    const examples = examplesForSector(sector);
    assert.equal(examples.length, 4, sector);
    for (const previewUrl of [
      undefined,
      "https://faithfulsoftware.dev/preview/existing-company",
    ]) {
      const email = renderSectorExampleFirstEmail({
        ...input,
        sector,
        previewUrl,
      });
      for (const example of examples)
        assert.ok(
          email.html.includes(
            `href="https://faithfulsoftware.dev/examples/${example.slug}"`,
          ),
          example.slug,
        );
      assert.ok(
        email.wordCount >= 140 && email.wordCount <= 220,
        `${sector}: ${email.wordCount}`,
      );
      assert.deepEqual(parseFirstEmailCandidate(email), email);
      assert.equal(email.optOutSentence, input.optOutSentence);
      assert.equal(email.conceptDisclaimer, input.conceptDisclaimer);
    }
  }
});

test("business names resolve researched firms with ambiguous labels", () => {
  for (const [businessName, sector, theme] of [
    ["Hill Wood & Co", "Home and property services", "landscape"],
    ["Paperstone", "Retail", "supplies"],
    ["Kent Garage Equipment", "Automotive", "equipment"],
    ["Hardy Drainage", "Home and property services", "plumbing"],
    ["Jaguar Plumbing", "Home and property services", "plumbing"],
    ["Paragas", "Home and property services", "plumbing"],
    ["Plumbing Angels", "Home and property services", "plumbing"],
    ["ETE Electrical", "Home and property services", "electrical"],
    ["TH Electrical", "Home and property services", "electrical"],
  ]) {
    const examples = examplesForSector(sector, businessName);
    assert.equal(examples.length, 4, businessName);
    assert.ok(
      examples.every((example) => example.theme === theme),
      businessName,
    );
    const email = renderSectorExampleFirstEmail({
      ...input,
      sector,
      businessName,
    });
    for (const example of examples)
      assert.ok(email.text.includes(`/examples/${example.slug}`));
    assert.deepEqual(parseFirstEmailCandidate(email), email);
  }
});
