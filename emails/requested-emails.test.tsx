import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";
import test from "node:test";

import type { LeadCapturePayload } from "@/lib/forms/lead-capture";
import type { IntakeSubmissionPayload } from "@/lib/intake/schema";
import type { ResourceMeta } from "@/lib/types/resource";

import {
  ClientDeliveryThankYou,
  clientDeliveryThankYouSubject,
} from "./client-delivery-thank-you";
import { RESOURCE_DELIVERY_SUBJECT, ResourceDelivery } from "./resource-delivery";
import { SITE_ENQUIRY_THANK_YOU_SUBJECT, SiteEnquiryThankYou } from "./site-enquiry-thank-you";
import { renderEmail } from "./render-email";

// `server-only` only resolves to a no-op under a bundler's "react-server" export
// condition. Under plain node it resolves to a stub that throws by design, so
// this test's own require for the lib/server adapters swaps in a real no-op.
const require = createRequire(import.meta.url);
const moduleWithInternals = Module as unknown as {
  _resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const originalResolveFilename = moduleWithInternals._resolveFilename;
moduleWithInternals._resolveFilename = function (request, ...rest) {
  if (request === "server-only") {
    return require.resolve("./server-only-noop.cjs");
  }
  return originalResolveFilename.call(this, request, ...rest);
};

const { buildSubmitterConfirmationEmail } =
  require("@/lib/server/lead-email-templates") as typeof import("@/lib/server/lead-email-templates");
const { buildIntakeSubmitterConfirmationEmail } =
  require("@/lib/server/intake-email-template") as typeof import("@/lib/server/intake-email-template");

function resourceFixture(overrides: Partial<ResourceMeta> = {}): ResourceMeta {
  return {
    slug: "manual-process-audit-fss",
    title: "Manual Process Audit",
    shortDescription: "Audit your manual processes.",
    fullDescription: "A complete guide to auditing manual processes.",
    category: "Operations",
    format: "PDF",
    featured: false,
    downloadType: "pdf",
    coverImage: "/images/covers/manual-process-audit.png",
    benefits: ["Find the biggest handoff cost."],
    ctaLabel: "Download",
    thankYouMessage: "Thanks for downloading.",
    seoTitle: "Manual Process Audit",
    seoDescription: "Audit your manual processes.",
    delivery: {
      type: "direct_download",
      url: "/resource-downloads/Manual%20Process%20Audit.pdf",
      label: "Download Manual Process Audit (PDF)",
      fileName: "Manual Process Audit.pdf",
    },
    ...overrides,
  };
}

// React separates adjacent text/expression children with `<!-- -->` boundary
// comments in server-rendered HTML. Strip them before matching prose that
// spans an interpolated value (e.g. "at <!-- -->{businessName}<!-- -->.").
function stripReactCommentMarkers(html: string): string {
  return html.replace(/<!--\s*-->/g, "");
}

function leadPayloadFixture(overrides: Partial<LeadCapturePayload> = {}): LeadCapturePayload {
  return {
    firstName: "O'Connor",
    lastName: "Smith",
    workEmail: "oconnor@example.test",
    company: "Ó Briain & Sons",
    sourceContext: "contact_form",
    sourcePath: "/contact",
    ...overrides,
  };
}

test("SiteEnquiryThankYou renders the approved subject, preview, and body copy", async () => {
  const { html, text } = await renderEmail({
    templateKey: "site-enquiry-thank-you",
    element: <SiteEnquiryThankYou firstName="Ada" businessName="Lovelace Systems" />,
  });

  const prose = stripReactCommentMarkers(html);
  assert.match(prose, />We received your request</);
  assert.match(prose, /Thank you for telling us about the enquiry process at Lovelace Systems\./);
  assert.match(prose, /within two working days/);
  assert.match(text, /Ada/);
});

test("SiteEnquiryThankYou handles names with apostrophes and non-ASCII characters", async () => {
  const { html, text } = await renderEmail({
    templateKey: "site-enquiry-thank-you",
    element: <SiteEnquiryThankYou firstName="O'Connor" businessName="Ó Briain & Sons" />,
  });

  const prose = stripReactCommentMarkers(html);
  assert.match(prose, /Hi O&#x27;Connor,/);
  assert.match(prose, /Ó Briain &amp; Sons/);
  assert.doesNotMatch(html, /<[^>]*O'Connor[^>]*>/);
  assert.match(text, /O'Connor/);
  assert.match(text, /Ó Briain & Sons/);
});

test("SiteEnquiryThankYou throws when the first name or business name is blank", async () => {
  await assert.rejects(
    renderEmail({
      templateKey: "site-enquiry-thank-you",
      element: <SiteEnquiryThankYou firstName="  " businessName="Lovelace Systems" />,
    }),
    /requires a first name/,
  );
  await assert.rejects(
    renderEmail({
      templateKey: "site-enquiry-thank-you",
      element: <SiteEnquiryThankYou firstName="Ada" businessName="  " />,
    }),
    /requires a business name/,
  );
});

test("ResourceDelivery renders the resource title and repeats the URL as a button and raw link", async () => {
  const { html, text } = await renderEmail({
    templateKey: "resource-delivery",
    element: (
      <ResourceDelivery
        firstName="Ada"
        resourceTitle="Manual Process Audit"
        resourceUrl="https://faithfulsoftwaresolutions.co.uk/resource-downloads/Manual%20Process%20Audit.pdf"
      />
    ),
  });

  assert.match(stripReactCommentMarkers(html), /Your copy of Manual Process Audit is ready\./);
  assert.equal(
    (html.match(/faithfulsoftwaresolutions\.co\.uk\/resource-downloads\/Manual%20Process%20Audit\.pdf/g) ?? [])
      .length,
    2,
  );
  assert.match(text, /Manual Process Audit/);
  assert.ok(
    text.includes(
      "https://faithfulsoftwaresolutions.co.uk/resource-downloads/Manual%20Process%20Audit.pdf",
    ),
  );
});

test("ResourceDelivery throws for a non-HTTPS resource URL", async () => {
  await assert.rejects(
    renderEmail({
      templateKey: "resource-delivery",
      element: (
        <ResourceDelivery
          firstName="Ada"
          resourceTitle="Manual Process Audit"
          resourceUrl="http://faithfulsoftwaresolutions.co.uk/resource-downloads/audit.pdf"
        />
      ),
    }),
    /valid HTTPS resource URL/,
  );
});

test("ClientDeliveryThankYou includes the newsletter invitation only when an opt-in URL is provided", async () => {
  const withInvite = await renderEmail({
    templateKey: "client-delivery-thank-you",
    element: (
      <ClientDeliveryThankYou
        firstName="Ada"
        engagementName="the enquiry portal build"
        newsletterOptInUrl="https://faithfulsoftwaresolutions.co.uk/newsletter/join?token=abc"
      />
    ),
  });
  assert.match(withInvite.html, /FSS Field Notes/);
  assert.match(withInvite.html, /has not subscribed you/);

  const withoutInvite = await renderEmail({
    templateKey: "client-delivery-thank-you",
    element: <ClientDeliveryThankYou firstName="Ada" engagementName="the enquiry portal build" />,
  });
  assert.doesNotMatch(withoutInvite.html, /FSS Field Notes/);
  assert.doesNotMatch(withoutInvite.html, /has not subscribed you/);
});

test("clientDeliveryThankYouSubject includes the engagement name and rejects a blank one", () => {
  assert.equal(
    clientDeliveryThankYouSubject("the enquiry portal build"),
    "Thank you for trusting FSS with the enquiry portal build",
  );
  assert.throws(() => clientDeliveryThankYouSubject("  "), /requires a engagement name/);
});

test("lead adapter sends the resource-delivery template when a resource has an immediate delivery action", async () => {
  const email = await buildSubmitterConfirmationEmail({
    payload: leadPayloadFixture({ resourceSlug: "manual-process-audit-fss" }),
    siteUrl: "https://faithfulsoftwaresolutions.co.uk",
    resource: resourceFixture(),
  });

  assert.equal(email.subject, RESOURCE_DELIVERY_SUBJECT);
  assert.match(email.html, /Manual Process Audit/);
  assert.match(
    email.html,
    /https:\/\/faithfulsoftwaresolutions\.co\.uk\/resource-downloads\/Manual%20Process%20Audit\.pdf/,
  );
});

test("lead adapter falls back to the site-enquiry-thank-you template with no resource", async () => {
  const email = await buildSubmitterConfirmationEmail({
    payload: leadPayloadFixture(),
    siteUrl: "https://faithfulsoftwaresolutions.co.uk",
    resource: null,
  });

  assert.equal(email.subject, SITE_ENQUIRY_THANK_YOU_SUBJECT);
  assert.match(stripReactCommentMarkers(email.html), /Ó Briain &amp; Sons/);
});

test("lead adapter falls back to the site-enquiry-thank-you template for a delayed resource", async () => {
  const email = await buildSubmitterConfirmationEmail({
    payload: leadPayloadFixture({ resourceSlug: "future-resource" }),
    siteUrl: "https://faithfulsoftwaresolutions.co.uk",
    resource: resourceFixture({ delivery: { type: "email_later" } }),
  });

  assert.equal(email.subject, SITE_ENQUIRY_THANK_YOU_SUBJECT);
});

test("intake adapter uses the submitted business name", async () => {
  const payload: IntakeSubmissionPayload = intakePayloadFixture({ businessName: "Lovelace Systems" });

  const email = await buildIntakeSubmitterConfirmationEmail({
    payload,
    siteUrl: "https://faithfulsoftwaresolutions.co.uk",
  });

  assert.equal(email.subject, SITE_ENQUIRY_THANK_YOU_SUBJECT);
  assert.match(stripReactCommentMarkers(email.html), /at Lovelace Systems\./);
});

test("intake adapter falls back to a generic business phrase when no business name was given", async () => {
  const payload: IntakeSubmissionPayload = intakePayloadFixture({ businessName: undefined });

  const email = await buildIntakeSubmitterConfirmationEmail({
    payload,
    siteUrl: "https://faithfulsoftwaresolutions.co.uk",
  });

  const prose = stripReactCommentMarkers(email.html);
  assert.match(prose, /at your business\./);
  assert.doesNotMatch(prose, /at \./);
});

function intakePayloadFixture(overrides: Partial<IntakeSubmissionPayload> = {}): IntakeSubmissionPayload {
  return {
    firstName: "Ada",
    email: "ada@example.test",
    businessName: undefined,
    stage: "idea",
    ideaDescription: "A platform that structures enquiries before the first call.",
    problem: "Enquiries arrive with missing context and require repeated follow-up.",
    targetCustomer: "Local service businesses that miss calls after hours.",
    demandEvidence: "none",
    goals6to12Months: "Validate demand with a handful of pilot customers.",
    primaryGoal: "test-demand",
    audienceSize: "none",
    productNeed: "not-sure",
    willingnessToPay: "not-sure",
    budget: "not-sure",
    sourcePath: "/start",
    botField: "",
    ...overrides,
  };
}
