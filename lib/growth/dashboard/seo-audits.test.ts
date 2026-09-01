import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthQueryExecutor } from "../db/types";
import {
  createStoredSeoAuditDraft,
  type SeoAuditSubmission,
} from "../seo-audits/schema";

import { getSeoAuditReview } from "./seo-audits";

const auditId = "11111111-1111-4111-8111-111111111111";

function createSubmission(): SeoAuditSubmission {
  return {
    auditId,
    audit: {
      executiveSummary:
        "The public site gives customers a clear view of the service, but several pages can answer local questions more directly before visitors are asked to make contact.",
      scores: {
        technicalSeo: 65,
        onPageSeo: 58,
        localSeo: 61,
        answerEngineReadiness: 44,
      },
      strengths: [
        "The service pages describe the work in language that prospective customers can understand without specialist knowledge.",
      ],
      findings: [
        "service-pages",
        "faqs",
        "local-proofs",
        "business-profile",
      ].map((id) => ({
        id,
        severity: "high" as const,
        title: `Improve ${id.replaceAll("-", " ")}`,
        evidence:
          "The reviewed public pages do not always give a specific locally relevant answer before directing visitors to contact the business.",
        whyItMatters:
          "Clear, specific information helps customers and search systems connect the service to the questions local people actually ask.",
        actions: [
          {
            title: "Update the page copy",
            instructions:
              "Add a direct customer-facing answer near the top of the page, then confirm the relevant service area and the next practical step.",
          },
        ],
      })),
      answerEngineSummary:
        "Write concise service answers and frequently asked questions using the same words customers use in calls and emails, then keep those facts consistent across the site and profile.",
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
        "Hi Sam, I reviewed the public pages for Example Services after my earlier note. There are several practical changes your team can make in the site editor without touching the codebase.",
        "I focused the report on service-page clarity, local visibility and the questions that answer engines need a business to explain plainly. I hope it is useful whether we speak or not.",
      ],
    },
  };
}

test("reviews a draft after the sent Day 5 follow-up", async () => {
  const stored = createStoredSeoAuditDraft({
    submission: createSubmission(),
    reportUrl: "https://example.test/reports/example-audit.pdf",
    reportSha256: "a".repeat(64),
  });
  const queries: string[] = [];
  const db = (async (strings: TemplateStringsArray) => {
    queries.push(strings.join("?").replace(/\s+/g, " ").trim());
    return [
      {
        auditId,
        version: 1,
        status: "draft",
        outputSnapshot: stored,
        businessName: "Example Services Limited",
        websiteUrl: "https://example.test",
        contactFirstName: "Sam",
        contactLastName: "Taylor",
        contactEmail: "sam@example.test",
        completedAt: new Date("2026-09-01T06:30:00.000Z"),
        firstSentAt: new Date("2026-08-22T09:00:00.000Z"),
        sequenceStatus: "active",
        secondFollowUpSent: true,
        hasInboundReply: false,
        isSuppressed: false,
        subscriberType: "corporate",
        corporateStatus: "active",
      },
    ];
  }) as unknown as GrowthQueryExecutor;

  const result = await getSeoAuditReview(auditId, db);

  assert.equal(result.status, "ready");
  if (result.status !== "ready") return;

  assert.equal(result.data.eligibility.ready, true);
  assert.match(queries[0] ?? "", /step_number = 1/);
  assert.doesNotMatch(queries[0] ?? "", /step_number = 2/);
});
