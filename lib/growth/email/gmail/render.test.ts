import assert from "node:assert/strict";
import test from "node:test";

import type { FirstEmailCandidate } from "../../research/types";
import {
  renderApprovedFirstEmail,
  renderPublishedFollowUp,
  type GmailMessageEnvelope,
  type PublishedFollowUpSnapshot,
  type RenderableFirstEmailVisual,
} from "./render";

const envelope: GmailMessageEnvelope = {
  id: "123e4567-e89b-42d3-a456-426614174000",
  from: "j.ntagengwa@faithfulsoftware.dev",
  to: "founder@example.test",
  replyTo: "j.ntagengwa@faithfulsoftware.dev",
};
const conceptDisclaimer =
  "Concept image for discussion only; it is not a finished design.";
const optOutSentence = "Reply opt out and I will send no further emails.";
const assetId = "987e6543-e21b-42d3-a456-426614174999";
const bodyWords = Array.from(
  { length: 125 },
  (_, index) => `word${index + 1}`,
).join(" ");
const text = `${bodyWords}\n\n${conceptDisclaimer}\n\n${optOutSentence}`;
const snapshot: FirstEmailCandidate = {
  subject: "A practical idea for Example & Sons",
  html: `<p>${bodyWords}</p><p>${conceptDisclaimer}</p><p>${optOutSentence}</p>`,
  text,
  wordCount: text.trim().split(/\s+/).length,
  conceptDisclaimer,
  optOutSentence,
};
const visual: RenderableFirstEmailVisual = {
  kind: "approved",
  assetId,
  url: `https://fss.public.blob.vercel-storage.com/growth-email-assets/${assetId}.webp`,
  width: 1200,
  height: 630,
  byteSize: 172_000,
  altText:
    "Concept illustration of Example & Sons' streamlined enquiry workflow.",
  conceptDisclaimer,
};

function decodeRaw(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

function decodeMimeParts(raw: string): [text: string, html: string] {
  const mime = decodeRaw(raw);
  const parts = Array.from(
    mime.matchAll(
      /Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g,
    ),
    (match) =>
      Buffer.from(match[1].replace(/\r\n/g, ""), "base64").toString("utf8"),
  );

  assert.equal(parts.length, 2);
  return [parts[0], parts[1]];
}

test("renders an immutable first-email snapshot with one visible concept image", () => {
  const rendered = renderApprovedFirstEmail({ envelope, snapshot, visual });
  const [renderedText, renderedHtml] = decodeMimeParts(rendered.raw);

  assert.equal(renderedText, snapshot.text);
  assert.equal((renderedHtml.match(/<img\b/g) ?? []).length, 1);
  assert.equal(
    (renderedHtml.match(new RegExp(`${assetId}\\.webp`, "g")) ?? []).length,
    1,
  );
  assert.match(
    renderedHtml,
    new RegExp(
      `<img src="https://fss\\.public\\.blob\\.vercel-storage\\.com/growth-email-assets/${assetId}\\.webp" alt="Concept illustration of Example &amp; Sons&#39; streamlined enquiry workflow\\." width="560" height="294">`,
    ),
  );
  assert.equal(
    (renderedHtml.match(/Concept image for discussion only/g) ?? []).length,
    1,
  );
  assert.match(
    renderedHtml,
    /<\/p><p>Concept image for discussion only; it is not a finished design\.<\/p><p>word1/,
  );
  assert.equal(renderedHtml.includes(optOutSentence), true);
  assert.doesNotMatch(renderedHtml, /style=|width="1"|height="1"/i);
});

test("rejects first-email snapshots that no longer satisfy the approved contract", () => {
  const cases: FirstEmailCandidate[] = [
    { ...snapshot, wordCount: snapshot.wordCount - 1 },
    { ...snapshot, text: snapshot.text.replace(optOutSentence, "") },
    { ...snapshot, html: snapshot.html.replace(conceptDisclaimer, "") },
    {
      ...snapshot,
      html: `${snapshot.html}<img src="https://tracker.test/pixel">`,
    },
    {
      ...snapshot,
      html: snapshot.html.replace(
        `<p>${optOutSentence}</p>`,
        `<p><a href="https://example.test/${optOutSentence}">Preferences</a></p>`,
      ),
    },
  ];

  for (const invalidSnapshot of cases) {
    assert.throws(
      () =>
        renderApprovedFirstEmail({
          envelope,
          snapshot: invalidSnapshot,
          visual,
        }),
      /snapshot|HTML|word count|opt-out|disclaimer/i,
    );
  }
});

test("rejects unapproved, mismatched, unstable, recipient-specific, or hidden visuals", () => {
  const cases: RenderableFirstEmailVisual[] = [
    { ...visual, kind: "pending" } as unknown as RenderableFirstEmailVisual,
    { ...visual, conceptDisclaimer: "A different disclaimer." },
    { ...visual, url: "http://assets.example.test/concept.webp" },
    { ...visual, url: `${visual.url}?recipient=founder%40example.test` },
    {
      ...visual,
      url: "https://fss.public.blob.vercel-storage.com/growth-email-assets/%2566ounder%2540example.test.webp",
    },
    {
      ...visual,
      url: "https://fss.public.blob.vercel-storage.com/growth-email-assets/Zm91bmRlckBleGFtcGxlLnRlc3Q.webp",
    },
    { ...visual, width: 1, height: 1 },
    { ...visual, width: 1200, height: 1200 },
    { ...visual, byteSize: 180 * 1024 + 1 },
    { ...visual, altText: "Too short" },
  ];

  for (const invalidVisual of cases) {
    assert.throws(
      () =>
        renderApprovedFirstEmail({
          envelope,
          snapshot,
          visual: invalidVisual,
        }),
      /visual|image|URL|recipient|disclaimer|alt/i,
    );
  }
});

test("renders a known fallback from the configured public site origin", () => {
  const rendered = renderApprovedFirstEmail({
    envelope,
    snapshot,
    visual: {
      kind: "fallback",
      fallbackKey: "hospitality",
      siteOrigin: "https://faithfulsoftwaresolutions.co.uk",
      conceptDisclaimer,
    },
  });
  const [, renderedHtml] = decodeMimeParts(rendered.raw);

  assert.match(
    renderedHtml,
    /src="https:\/\/faithfulsoftwaresolutions\.co\.uk\/growth\/email\/fallbacks\/hospitality\.webp"/,
  );
  assert.match(renderedHtml, /alt="Concept illustration of a hospitality/);
});

const followUpSnapshot: PublishedFollowUpSnapshot = {
  status: "published",
  htmlTemplate:
    "<p>Hi {{firstName}},</p><p>A focused workflow could help {{businessName}}.</p>",
  textTemplate:
    "Hi {{firstName}},\n\nA focused workflow could help {{businessName}}.",
  requiredFields: ["firstName", "businessName"],
};
const thread = {
  gmailThreadId: "gmail-thread-id",
  parentMessageId:
    "<growthos.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa@faithfulsoftware.dev>",
  references: ["<earlier@example.test>"],
};

test("renders a published follow-up in the original thread with escaped merge fields", () => {
  const rendered = renderPublishedFollowUp({
    envelope: { ...envelope, thread },
    subject: snapshot.subject,
    snapshot: followUpSnapshot,
    mergeFields: {
      firstName: "Ada <Founder>",
      businessName: "Example & Sons",
    },
  });
  const [renderedText, renderedHtml] = decodeMimeParts(rendered.raw);
  const mime = decodeRaw(rendered.raw);

  assert.equal(rendered.gmailThreadId, thread.gmailThreadId);
  assert.equal(
    renderedText,
    "Hi Ada <Founder>,\n\nA focused workflow could help Example & Sons.",
  );
  assert.equal(
    renderedHtml,
    "<p>Hi Ada &lt;Founder&gt;,</p><p>A focused workflow could help Example &amp; Sons.</p>",
  );
  assert.doesNotMatch(renderedHtml, /<img\b/i);
  assert.match(mime, /In-Reply-To: <growthos\.aaaaaaaa/);
  assert.match(mime, /References: <earlier@example\.test>/);
});

test("rejects draft, unthreaded, unknown, and inconsistent follow-up templates", () => {
  const cases: PublishedFollowUpSnapshot[] = [
    {
      ...followUpSnapshot,
      status: "draft",
    } as unknown as PublishedFollowUpSnapshot,
    {
      ...followUpSnapshot,
      htmlTemplate: "<p>Hi {{emailAddress}}</p>",
    },
    {
      ...followUpSnapshot,
      requiredFields: ["firstName"],
    },
    {
      ...followUpSnapshot,
      textTemplate: "Hi {{firstName}}, this omits the business field.",
    },
    {
      ...followUpSnapshot,
      htmlTemplate: `${followUpSnapshot.htmlTemplate}<img src="https://tracker.test/pixel">`,
    },
    {
      ...followUpSnapshot,
      htmlTemplate: "<p>Hi {{firstName}}, {{businessName</p>",
    },
  ];

  assert.throws(
    () =>
      renderPublishedFollowUp({
        envelope,
        subject: snapshot.subject,
        snapshot: followUpSnapshot,
        mergeFields: { firstName: "Ada", businessName: "Example" },
      }),
    /thread/i,
  );

  for (const invalidSnapshot of cases) {
    assert.throws(
      () =>
        renderPublishedFollowUp({
          envelope: { ...envelope, thread },
          subject: snapshot.subject,
          snapshot: invalidSnapshot,
          mergeFields: { firstName: "Ada", businessName: "Example" },
        }),
      /published|template|merge field|HTML/i,
    );
  }
});

test("rejects blank or control-bearing follow-up merge values", () => {
  for (const firstName of ["", "Ada\nBcc: attacker@example.test"]) {
    assert.throws(
      () =>
        renderPublishedFollowUp({
          envelope: { ...envelope, thread },
          subject: snapshot.subject,
          snapshot: followUpSnapshot,
          mergeFields: { firstName, businessName: "Example" },
        }),
      /merge field/i,
    );
  }
});
