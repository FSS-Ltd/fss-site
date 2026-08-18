import assert from "node:assert/strict";
import test from "node:test";

import type { NewsletterIssueContentInput } from "./content";
import { NewsletterContentError, validateNewsletterIssueContent } from "./content";

function contentFixture(overrides: Partial<NewsletterIssueContentInput> = {}): NewsletterIssueContentInput {
  return {
    subject: "The local service website is becoming an operating system",
    previewText: "Three practical ways to turn enquiries into better work.",
    unsubscribeUrl: "https://faithfulsoftwaresolutions.co.uk/newsletter/unsubscribe?token=abc",
    sections: [
      {
        type: "position",
        heading: "Most local service websites stop at explaining what the business does",
        body: [
          "The better opportunity is to help the business handle what happens next.",
          "A practical website can collect the right information before the first call.",
        ],
      },
      {
        type: "practice",
        heading: "Three practical ways to turn enquiries into better work",
        steps: [
          "Capture context before the call: ask for the job type, location, urgency and preferred contact method.",
          "Keep the human response: automation should prepare the conversation, not replace it.",
          "Connect enquiry to delivery: the same information can support quoting and scheduling.",
        ],
      },
      {
        type: "cta",
        label: "Read the practical guide",
        href: "https://faithfulsoftwaresolutions.co.uk/resources/manual-process-audit-fss",
      },
    ],
    founderNote:
      "If one part of your enquiry process is creating unnecessary work, reply and tell me where it breaks.",
    ...overrides,
  };
}

test("accepts complete, well-formed newsletter issue content", () => {
  const result = validateNewsletterIssueContent(contentFixture());
  assert.equal(result.subject, contentFixture().subject);
});

test("accepts content with no founder note or image", () => {
  const result = validateNewsletterIssueContent(
    contentFixture({ founderNote: undefined, image: undefined }),
  );
  assert.equal(result.founderNote, undefined);
});

test("rejects a blank subject", () => {
  assert.throws(
    () => validateNewsletterIssueContent(contentFixture({ subject: "   " })),
    NewsletterContentError,
  );
});

test("rejects a subject over the length limit", () => {
  assert.throws(
    () => validateNewsletterIssueContent(contentFixture({ subject: "x".repeat(151) })),
    /exceeds 150 characters/,
  );
});

test("rejects a blank preview text", () => {
  assert.throws(
    () => validateNewsletterIssueContent(contentFixture({ previewText: "" })),
    NewsletterContentError,
  );
});

test("rejects a preview text over the length limit", () => {
  assert.throws(
    () => validateNewsletterIssueContent(contentFixture({ previewText: "x".repeat(201) })),
    /exceeds 200 characters/,
  );
});

test("rejects a non-HTTPS unsubscribe URL", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({ unsubscribeUrl: "http://faithfulsoftwaresolutions.co.uk/unsubscribe" }),
      ),
    /must use HTTPS/,
  );
});

test("rejects an issue with no sections", () => {
  assert.throws(
    () => validateNewsletterIssueContent(contentFixture({ sections: [] })),
    /at least one section/,
  );
});

test("rejects more than one primary call to action", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({
          sections: [
            ...contentFixture().sections,
            { type: "cta", label: "Book a call", href: "https://faithfulsoftwaresolutions.co.uk/contact" },
          ],
        }),
      ),
    /at most one primary call to action/,
  );
});

test("rejects a position section with no body paragraphs", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({ sections: [{ type: "position", heading: "Empty section", body: [] }] }),
      ),
    /has no body content/,
  );
});

test("rejects a position section with a blank paragraph", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({
          sections: [{ type: "position", heading: "Heading", body: ["Real paragraph.", "   "] }],
        }),
      ),
    NewsletterContentError,
  );
});

test("rejects a practice section with no steps", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({ sections: [{ type: "practice", heading: "Heading", steps: [] }] }),
      ),
    /has no steps/,
  );
});

test("rejects a call-to-action with a non-HTTPS link", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({
          sections: [
            { type: "cta", label: "Read more", href: "http://faithfulsoftwaresolutions.co.uk/guide" },
          ],
        }),
      ),
    /must use HTTPS/,
  );
});

const bannedClaimCases: { field: string; input: NewsletterIssueContentInput }[] = [
  {
    field: "a testimonial mention",
    input: contentFixture({
      sections: [{ type: "position", heading: "Heading", body: ["Read this testimonial from a client."] }],
    }),
  },
  {
    field: "a star rating claim",
    input: contentFixture({
      sections: [{ type: "position", heading: "Heading", body: ["Rated a 5-star service by everyone."] }],
    }),
  },
  {
    field: "a guarantee claim",
    input: contentFixture({
      sections: [{ type: "position", heading: "Heading", body: ["We guarantee more leads."] }],
    }),
  },
  {
    field: "a before-and-after claim",
    input: contentFixture({
      sections: [{ type: "position", heading: "Heading", body: ["See the before and after results."] }],
    }),
  },
  {
    field: "a fabricated revenue percentage claim",
    input: contentFixture({
      sections: [{ type: "position", heading: "Heading", body: ["This will increase revenue by 40%."] }],
    }),
  },
];

for (const { field, input } of bannedClaimCases) {
  test(`rejects ${field}`, () => {
    assert.throws(() => validateNewsletterIssueContent(input), /banned claim/);
  });
}

test("rejects a banned claim inside the founder note", () => {
  assert.throws(
    () => validateNewsletterIssueContent(contentFixture({ founderNote: "This is a proven results system." })),
    /banned claim/,
  );
});

test("rejects an image with no alt text", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({
          image: { src: "https://faithfulsoftwaresolutions.co.uk/image.webp", alt: "  ", width: 1200, height: 630 },
        }),
      ),
    NewsletterContentError,
  );
});

test("rejects an image with non-positive dimensions", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({
          image: {
            src: "https://faithfulsoftwaresolutions.co.uk/image.webp",
            alt: "A concept image.",
            width: 0,
            height: 630,
          },
        }),
      ),
    /positive integer dimensions/,
  );
});

test("rejects an image with a non-HTTPS source", () => {
  assert.throws(
    () =>
      validateNewsletterIssueContent(
        contentFixture({
          image: {
            src: "http://faithfulsoftwaresolutions.co.uk/image.webp",
            alt: "A concept image.",
            width: 1200,
            height: 630,
          },
        }),
      ),
    /must use HTTPS/,
  );
});
