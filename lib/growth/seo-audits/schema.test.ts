import assert from "node:assert/strict";
import test from "node:test";

import {
  createStoredSeoAuditDraft,
  parseStoredSeoAuditDraft,
  seoAuditSubmissionSchema,
  type SeoAuditSubmission,
} from "./schema";

const reportUrl = "https://example.test/reports/example-audit.pdf";
const reportSha256 = "a".repeat(64);

function submission(): SeoAuditSubmission {
  return {
    auditId: "11111111-1111-4111-8111-111111111111",
    audit: {
      executiveSummary:
        "The website has a credible service offer, but the core pages do not answer the local questions prospective customers are likely to search before they contact the business.",
      scores: {
        technicalSeo: 58,
        onPageSeo: 46,
        localSeo: 61,
        answerEngineReadiness: 35,
      },
      strengths: [
        "The service pages use clear language that customers can recognise quickly.",
      ],
      findings: [
        "title-tags",
        "service-faqs",
        "local-pages",
        "business-profile",
      ].map((id) => ({
        id,
        severity: "high" as const,
        title: `Improve ${id.replaceAll("-", " ")}`,
        evidence:
          "The public pages do not consistently give a direct, locally relevant answer before asking the visitor to contact the business.",
        whyItMatters:
          "Search engines and answer engines need clear, specific information to connect this service to the questions local customers ask.",
        actions: [
          {
            title: "Update the page copy",
            instructions:
              "Add one direct customer-facing answer near the top of the relevant page, then list the service area, price guidance where appropriate, and the next practical step.",
          },
        ],
      })),
      answerEngineSummary:
        "Create concise service answers and frequently asked questions using the same words customers use in calls and email enquiries, then keep the facts consistent across the website and business profile.",
      sources: [
        {
          title: "Main website",
          url: "https://example.test/",
          checkedAt: "2026-09-01T06:30:00.000Z",
        },
      ],
    },
    email: {
      subject: "A practical SEO audit for your team",
      paragraphs: [
        "Hi Sam, I spent some time reviewing the public pages for Example & Sons after my earlier notes. There are a few practical changes your team can make without touching the codebase.",
        "I have focused the report on service-page clarity, local visibility and the questions that answer engines need a business to explain plainly. I hope it is useful whether we speak or not.",
      ],
    },
  };
}

test("creates a safe stored email with a fixed report link and opt-out", () => {
  const stored = createStoredSeoAuditDraft({
    submission: submission(),
    reportUrl,
    reportSha256,
  });

  assert.equal(stored.reviewState, "draft");
  assert.equal(stored.email.wordCount >= 70, true);
  assert.match(stored.email.text, /full SEO and answer-engine audit/i);
  assert.match(stored.email.text, /reply and I will close the loop/i);
  assert.match(stored.email.html, /Download the full audit \(PDF\)/);
  assert.match(
    stored.email.html,
    /href="https:\/\/example\.test\/reports\/example-audit\.pdf"/,
  );
});

test("escapes agent email content instead of trusting it as HTML", () => {
  const unsafe = submission();
  unsafe.email.paragraphs[0] =
    "Hi Sam, this audit is useful even if <script>alert('no')</script> appears in the submitted draft text and it gives your team steps they can make today.";
  const stored = createStoredSeoAuditDraft({
    submission: unsafe,
    reportUrl,
    reportSha256,
  });

  assert.doesNotMatch(stored.email.html, /<script>/i);
  assert.match(stored.email.html, /&lt;script&gt;/i);
});

test("rejects a stored draft when its recorded word count has changed", () => {
  const stored = createStoredSeoAuditDraft({
    submission: submission(),
    reportUrl,
    reportSha256,
  });

  assert.throws(
    () =>
      parseStoredSeoAuditDraft({
        ...stored,
        email: { ...stored.email, wordCount: 1 },
      }),
    /invalid/i,
  );
});

test("requires a complete evidence-backed audit bundle", () => {
  const incomplete = submission();
  incomplete.audit.findings = incomplete.audit.findings.slice(0, 3);

  assert.equal(seoAuditSubmissionSchema.safeParse(incomplete).success, false);
});
