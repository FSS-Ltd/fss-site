import assert from "node:assert/strict";
import test from "node:test";

import { renderApprovedFirstEmail } from "../email/gmail/render";
import { createFounderFirstEmailRevision } from "./edit-first-email";

const optOutSentence = "Reply opt out if you would prefer no further emails.";
const conceptDisclaimer =
  "Concept image for discussion only and not a finished design.";

function words(count: number): string {
  return Array.from({ length: count }, (_, index) => `word${index}`).join(" ");
}

function decodeRenderedHtml(raw: string): string {
  const mime = Buffer.from(raw, "base64url").toString("utf8");
  const parts = Array.from(
    mime.matchAll(
      /Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g,
    ),
    (match) =>
      Buffer.from(match[1].replace(/\r\n/g, ""), "base64").toString("utf8"),
  );
  assert.equal(parts.length, 2);
  return parts[1];
}

function validInput() {
  return {
    subject: "A practical website idea for Example & Co",
    paragraphs: [words(125), optOutSentence, conceptDisclaimer],
    retained: { optOutSentence, conceptDisclaimer },
  };
}

test("creates a canonical safe snapshot from structured plain-text paragraphs", () => {
  const revision = createFounderFirstEmailRevision(validInput());

  assert.equal(revision.subject, "A practical website idea for Example & Co");
  assert.equal(
    revision.text,
    [words(125), optOutSentence, conceptDisclaimer].join("\n\n"),
  );
  assert.equal(revision.wordCount, 145);
  assert.equal(revision.optOutSentence, optOutSentence);
  assert.equal(revision.conceptDisclaimer, conceptDisclaimer);
  assert.equal(
    revision.html,
    `<p>${words(125)}</p><p>${optOutSentence}</p><p>${conceptDisclaimer}</p>`,
  );
});

test("escapes founder text instead of accepting arbitrary HTML", () => {
  const input = validInput();
  input.paragraphs[0] = `${words(121)} <script>alert('x')</script>`;

  const revision = createFounderFirstEmailRevision(input);

  assert.match(
    revision.html,
    /&lt;script&gt;alert\(&#39;x&#39;\)&lt;\/script&gt;/,
  );
  assert.equal(revision.html.includes("<script>"), false);
  assert.equal(revision.text.includes("<script>alert('x')</script>"), true);
});

test("rejects blank, oversized, or control-bearing subjects", () => {
  for (const subject of [" ", "a".repeat(201), "Safe\r\nBcc: attacker@test"]) {
    assert.throws(
      () => createFounderFirstEmailRevision({ ...validInput(), subject }),
      TypeError,
    );
  }
});

test("enforces the 140 to 220 word content standard", () => {
  for (const bodyWordCount of [119, 201]) {
    const input = validInput();
    input.paragraphs[0] = words(bodyWordCount);
    assert.throws(() => createFounderFirstEmailRevision(input), TypeError);
  }
});

test("requires the retained opt-out and disclaimer exactly once", () => {
  const missingOptOut = validInput();
  missingOptOut.paragraphs = [words(135), conceptDisclaimer];
  assert.throws(
    () => createFounderFirstEmailRevision(missingOptOut),
    /opt-out/i,
  );

  const missingDisclaimer = validInput();
  missingDisclaimer.paragraphs = [words(135), optOutSentence];
  assert.throws(
    () => createFounderFirstEmailRevision(missingDisclaimer),
    /disclaimer/i,
  );

  const duplicateOptOut = validInput();
  duplicateOptOut.paragraphs.push(optOutSentence);
  assert.throws(
    () => createFounderFirstEmailRevision(duplicateOptOut),
    /opt-out/i,
  );

  const embeddedDuplicateOptOut = validInput();
  embeddedDuplicateOptOut.paragraphs[0] = `${words(115)} ${optOutSentence}`;
  assert.throws(
    () => createFounderFirstEmailRevision(embeddedDuplicateOptOut),
    /opt-out/i,
  );

  const embeddedDuplicateDisclaimer = validInput();
  embeddedDuplicateDisclaimer.paragraphs[0] = `${words(115)} ${conceptDisclaimer}`;
  assert.throws(
    () => createFounderFirstEmailRevision(embeddedDuplicateDisclaimer),
    /disclaimer/i,
  );
});

test("preserves HTML-sensitive retained standards through Gmail rendering", () => {
  const sensitiveOptOut =
    "Reply opt out if R&D <isn't relevant> and you prefer no further emails.";
  const sensitiveDisclaimer =
    "Concept image for R&D <discussion> only, not a finished design.";
  const revision = createFounderFirstEmailRevision({
    subject: "A practical R&D idea",
    paragraphs: [words(125), sensitiveOptOut, sensitiveDisclaimer],
    retained: {
      optOutSentence: sensitiveOptOut,
      conceptDisclaimer: sensitiveDisclaimer,
    },
  });

  const rendered = renderApprovedFirstEmail({
    envelope: {
      id: "123e4567-e89b-42d3-a456-426614174000",
      from: "j.ntagengwa@faithfulsoftware.dev",
      to: "founder@example.test",
      replyTo: "j.ntagengwa@faithfulsoftware.dev",
    },
    snapshot: revision,
    visual: {
      kind: "fallback",
      fallbackKey: "hospitality",
      siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
      conceptDisclaimer: sensitiveDisclaimer,
    },
  });
  const html = decodeRenderedHtml(rendered.raw);

  assert.equal((html.match(/R&amp;D &lt;discussion&gt;/g) ?? []).length, 1);
  assert.equal(
    (html.match(/R&amp;D &lt;isn&#39;t relevant&gt;/g) ?? []).length,
    1,
  );
});

test("rejects malformed paragraph structures and retained standards", () => {
  const emptyParagraph = validInput();
  emptyParagraph.paragraphs[0] = " ";
  assert.throws(
    () => createFounderFirstEmailRevision(emptyParagraph),
    TypeError,
  );

  const multilineParagraph = validInput();
  multilineParagraph.paragraphs[0] = `${words(125)}\nHidden line`;
  assert.throws(
    () => createFounderFirstEmailRevision(multilineParagraph),
    TypeError,
  );

  const invalidOptOut = validInput();
  invalidOptOut.retained = {
    ...invalidOptOut.retained,
    optOutSentence: "Thank you for reading this message.",
  };
  assert.throws(
    () => createFounderFirstEmailRevision(invalidOptOut),
    /opt-out/i,
  );

  assert.throws(
    () =>
      createFounderFirstEmailRevision({
        ...validInput(),
        paragraphs: Array.from({ length: 21 }, () => "paragraph"),
      }),
    TypeError,
  );
});
