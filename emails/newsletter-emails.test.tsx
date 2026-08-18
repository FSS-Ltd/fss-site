import assert from "node:assert/strict";
import test from "node:test";

import type { NewsletterIssueContentInput } from "@/lib/growth/newsletter/content";

import { NEWSLETTER_WELCOME_PREVIEW, NEWSLETTER_WELCOME_SUBJECT, NewsletterWelcome } from "./newsletter-welcome";
import { NewsletterIssue } from "./newsletter-issue";
import { renderEmail } from "./render-email";

const POSTAL_ADDRESS = "Faithful Software Solutions Ltd, 1 Example Street, Maidstone, ME14 1AA, United Kingdom";
const UNSUBSCRIBE_URL = "https://faithfulsoftwaresolutions.co.uk/newsletter/unsubscribe?token=abc123";

// React separates adjacent text/expression children with `<!-- -->` boundary
// comments in server-rendered HTML. Strip them before matching prose that
// spans an interpolated value.
function stripReactCommentMarkers(html: string): string {
  return html.replace(/<!--\s*-->/g, "");
}

function issueContentFixture(
  overrides: Partial<NewsletterIssueContentInput> = {},
): NewsletterIssueContentInput {
  return {
    subject: "The local service website is becoming an operating system",
    previewText: "Three practical ways to turn enquiries into better work.",
    unsubscribeUrl: UNSUBSCRIBE_URL,
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
          "Capture context before the call.",
          "Keep the human response.",
          "Connect enquiry to delivery.",
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

test("NewsletterWelcome renders the approved subject, preview, and unsubscribe link", async () => {
  const { html, text } = await renderEmail({
    templateKey: "newsletter-welcome",
    element: (
      <NewsletterWelcome firstName="Ada" unsubscribeUrl={UNSUBSCRIBE_URL} postalAddress={POSTAL_ADDRESS} />
    ),
  });

  assert.match(html, />Welcome to FSS Field Notes</);
  assert.match(html, new RegExp(NEWSLETTER_WELCOME_PREVIEW.replace(/[.]/g, "\\$&")));
  assert.match(html, new RegExp(`<a href="${UNSUBSCRIBE_URL.replace(/[.?]/g, "\\$&")}"[^>]*>Unsubscribe</a>`));
  assert.ok(html.includes(POSTAL_ADDRESS));
  assert.ok(text.includes(POSTAL_ADDRESS));
  assert.equal(NEWSLETTER_WELCOME_SUBJECT, "Welcome to FSS Field Notes");
});

test("NewsletterWelcome throws when the unsubscribe URL or postal address is missing", async () => {
  await assert.rejects(
    renderEmail({
      templateKey: "newsletter-welcome",
      element: <NewsletterWelcome firstName="Ada" unsubscribeUrl="" postalAddress={POSTAL_ADDRESS} />,
    }),
  );
  await assert.rejects(
    renderEmail({
      templateKey: "newsletter-welcome",
      element: <NewsletterWelcome firstName="Ada" unsubscribeUrl={UNSUBSCRIBE_URL} postalAddress="  " />,
    }),
    /requires a postal address/,
  );
});

test("NewsletterIssue renders every section type, the founder note, and the postal address", async () => {
  const { html, text } = await renderEmail({
    templateKey: "newsletter-issue",
    element: <NewsletterIssue {...issueContentFixture()} postalAddress={POSTAL_ADDRESS} />,
  });

  const prose = stripReactCommentMarkers(html);
  assert.match(prose, />Most local service websites stop at explaining what the business does</);
  assert.match(prose, />Three practical ways to turn enquiries into better work</);
  assert.match(prose, /1\. Capture context before the call\./);
  assert.match(prose, />Read the practical guide</);
  assert.ok(html.includes("If one part of your enquiry process is creating unnecessary work"));
  assert.ok(html.includes(POSTAL_ADDRESS));
  assert.ok(text.includes(POSTAL_ADDRESS));
  assert.doesNotMatch(text, /<[a-z][^>]*>/i);
});

test("NewsletterIssue renders exactly one call-to-action link", async () => {
  const { html } = await renderEmail({
    templateKey: "newsletter-issue",
    element: <NewsletterIssue {...issueContentFixture()} postalAddress={POSTAL_ADDRESS} />,
  });

  assert.equal(
    (html.match(/https:\/\/faithfulsoftwaresolutions\.co\.uk\/resources\/manual-process-audit-fss/g) ?? [])
      .length,
    1,
  );
});

test("NewsletterIssue renders a provided image with alt text and explicit dimensions", async () => {
  const { html } = await renderEmail({
    templateKey: "newsletter-issue",
    element: (
      <NewsletterIssue
        {...issueContentFixture({
          image: {
            src: "https://faithfulsoftwaresolutions.co.uk/newsletter-image.webp",
            alt: "Connected FSS workspace showing an enquiry moving through one organised system.",
            width: 1200,
            height: 630,
          },
        })}
        postalAddress={POSTAL_ADDRESS}
      />
    ),
  });

  assert.equal((html.match(/<img/gi) ?? []).length, 1);
  assert.match(html, /alt="Connected FSS workspace showing an enquiry moving through one organised system\."/);
  assert.match(html, /width="1200"/);
  assert.match(html, /height="630"/);
});

test("NewsletterIssue includes an unsubscribe link and rejects content-standard violations", async () => {
  const { html, text } = await renderEmail({
    templateKey: "newsletter-issue",
    element: <NewsletterIssue {...issueContentFixture()} postalAddress={POSTAL_ADDRESS} />,
  });

  assert.match(html, new RegExp(`<a href="${UNSUBSCRIBE_URL.replace(/[.?]/g, "\\$&")}"[^>]*>Unsubscribe</a>`));
  assert.ok(text.includes(UNSUBSCRIBE_URL));

  await assert.rejects(
    renderEmail({
      templateKey: "newsletter-issue",
      element: (
        <NewsletterIssue
          {...issueContentFixture({
            sections: [
              { type: "position", heading: "Heading", body: ["We guarantee more leads for every reader."] },
            ],
          })}
          postalAddress={POSTAL_ADDRESS}
        />
      ),
    }),
    /banned claim/,
  );
});
