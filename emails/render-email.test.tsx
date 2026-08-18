import assert from "node:assert/strict";
import test from "node:test";

import { render } from "@react-email/render";
import { Text } from "@react-email/components";

import { EmailImage } from "./components/email-image";
import { FssEmailLayout } from "./components/fss-email-layout";
import { emailSpacing } from "./styles";
import { renderEmail, type RenderEmailInput } from "./render-email";

const REPLY_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const COMPANY_NAME = "Faithful Software Solutions Ltd";

function transactionalFixture(overrides: Partial<RenderEmailInput> = {}): RenderEmailInput {
  return {
    templateKey: "site-enquiry-thank-you",
    element: (
      <FssEmailLayout category="transactional" previewText="A test preview snippet" title="Test Title">
        <Text>Test paragraph content.</Text>
      </FssEmailLayout>
    ),
    ...overrides,
  };
}

test("rejects a template key that is not allowlisted", async () => {
  await assert.rejects(
    renderEmail({ ...transactionalFixture(), templateKey: "cold-outreach" as never }),
    /not allowlisted/,
  );
});

test("renders the FSS wordmark, preview text, and title", async () => {
  const { html } = await renderEmail(transactionalFixture());

  assert.match(html, /Faithful Software Solutions/);
  assert.match(html, /A test preview snippet/);
  assert.match(html, />Test Title</);
});

test("keeps the container no wider than 640px", async () => {
  assert.ok(emailSpacing.containerMaxWidth <= 640);
  const { html } = await renderEmail(transactionalFixture());

  assert.match(html, /max-width:640px/);
});

test("renders a provided image with alt text and explicit dimensions", async () => {
  const { html } = await renderEmail({
    templateKey: "resource-delivery",
    element: (
      <FssEmailLayout
        category="resource-delivery"
        previewText="Resource preview"
        title="Resource Title"
        image={{
          src: "https://example.test/image.webp",
          alt: "A concept image for testing.",
          width: 1200,
          height: 630,
        }}
      >
        <Text>Resource body content.</Text>
      </FssEmailLayout>
    ),
  });

  assert.equal((html.match(/<img/gi) ?? []).length, 1);
  assert.match(html, /alt="A concept image for testing\."/);
  assert.match(html, /width="1200"/);
  assert.match(html, /height="630"/);
});

test("throws when an image has no alt text", async () => {
  await assert.rejects(
    render(<EmailImage src="https://example.test/x.webp" alt="   " width={1200} height={630} />),
    /non-empty alt text/,
  );
});

test("throws when an image has non-positive dimensions", async () => {
  await assert.rejects(
    render(<EmailImage src="https://example.test/x.webp" alt="Valid alt text." width={0} height={630} />),
    /positive integer dimensions/,
  );
});

test("keeps plain text understandable with no image and no markup", async () => {
  const { text } = await renderEmail(transactionalFixture());

  assert.doesNotMatch(text, /<[a-z][^>]*>/i);
  assert.match(text, /Test paragraph content\./);
});

test("shows the workspace reply address and company identity in html and text", async () => {
  const { html, text } = await renderEmail(transactionalFixture());

  for (const rendered of [html, text]) {
    assert.ok(rendered.includes(REPLY_EMAIL));
    assert.ok(rendered.includes(COMPANY_NAME));
  }
});

test("explains why a transactional recipient received the email, with no unsubscribe link", async () => {
  const { html, text } = await renderEmail(transactionalFixture());

  assert.match(html, /You are receiving this because you contacted/);
  assert.doesNotMatch(html, />Unsubscribe</);
  assert.doesNotMatch(text, /Unsubscribe/);
});

test("explains why a resource-delivery recipient received the email", async () => {
  const { html } = await renderEmail({
    templateKey: "resource-delivery",
    element: (
      <FssEmailLayout category="resource-delivery" previewText="Resource preview" title="Resource Title">
        <Text>Resource body content.</Text>
      </FssEmailLayout>
    ),
  });

  assert.match(html, /You are receiving this because you requested this resource/);
});

test("includes a working unsubscribe link for the newsletter category", async () => {
  const unsubscribeUrl = "https://faithfulsoftwaresolutions.co.uk/newsletter/unsubscribe?token=abc123";
  const { html, text } = await renderEmail({
    templateKey: "newsletter-issue",
    element: (
      <FssEmailLayout
        category="newsletter"
        previewText="Newsletter preview"
        title="Issue Title"
        unsubscribeUrl={unsubscribeUrl}
      >
        <Text>Newsletter body content.</Text>
      </FssEmailLayout>
    ),
  });

  assert.match(html, new RegExp(`<a href="${unsubscribeUrl.replace(/[.?]/g, "\\$&")}"[^>]*>Unsubscribe</a>`));
  assert.ok(text.includes(unsubscribeUrl));
});

test("throws when a newsletter email has no unsubscribe URL", async () => {
  await assert.rejects(
    renderEmail({
      templateKey: "newsletter-issue",
      element: (
        <FssEmailLayout category="newsletter" previewText="x" title="x">
          <Text>x</Text>
        </FssEmailLayout>
      ),
    }),
    /require an unsubscribe URL/,
  );
});

test("renders no tracking pixel, remote font, script, form, or video", async () => {
  const { html } = await renderEmail(transactionalFixture());

  assert.doesNotMatch(html, /<script/i);
  assert.doesNotMatch(html, /<form/i);
  assert.doesNotMatch(html, /<video/i);
  assert.doesNotMatch(html, /<iframe/i);
  assert.doesNotMatch(html, /@font-face/i);
  assert.equal((html.match(/<img/gi) ?? []).length, 0);
});

test("computes a deterministic checksum for identical content", async () => {
  const first = await renderEmail(transactionalFixture());
  const second = await renderEmail(transactionalFixture());

  assert.equal(first.checksum, second.checksum);
  assert.match(first.checksum, /^[0-9a-f]{64}$/);
});

test("computes a different checksum when content changes", async () => {
  const first = await renderEmail(transactionalFixture());
  const second = await renderEmail({
    templateKey: "site-enquiry-thank-you",
    element: (
      <FssEmailLayout category="transactional" previewText="A test preview snippet" title="Different Title">
        <Text>Test paragraph content.</Text>
      </FssEmailLayout>
    ),
  });

  assert.notEqual(first.checksum, second.checksum);
});

test("returns the requested template key in the result", async () => {
  const result = await renderEmail(transactionalFixture());

  assert.equal(result.templateKey, "site-enquiry-thank-you");
});
