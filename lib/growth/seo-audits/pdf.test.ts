import assert from "node:assert/strict";
import test from "node:test";

import { renderSeoAuditPdf } from "./pdf";
import type { SeoAeoAudit } from "./schema";

const audit: SeoAeoAudit = {
  executiveSummary:
    "The business has useful service information, but the pages need clearer local answers and more consistent guidance for customers who are comparing providers.",
  scores: {
    technicalSeo: 62,
    onPageSeo: 47,
    localSeo: 58,
    answerEngineReadiness: 39,
  },
  strengths: [
    "The website already explains the business services in language customers can understand.",
  ],
  findings: ["titles", "faqs", "local-landing-pages", "business-profile"].map(
    (id) => ({
      id,
      severity: "medium" as const,
      title: `Improve ${id.replaceAll("-", " ")}`,
      evidence:
        "The public site does not consistently show a direct, local answer for customers researching this service.",
      whyItMatters:
        "Clear answers make it easier for search and answer engines to match the business to specific customer questions.",
      actions: [
        {
          title: "Update the page",
          instructions:
            "Add a clear answer near the top of the page, then explain the service area and the next step a customer should take.",
        },
      ],
    }),
  ),
  answerEngineSummary:
    "Use concise service answers and customer questions consistently across the website and business profile.",
  sources: [
    {
      title: "Website homepage",
      url: "https://example.test/",
      checkedAt: "2026-09-01T06:30:00.000Z",
    },
  ],
};

test("renders a non-empty downloadable PDF for a validated audit", async () => {
  const pdf = await renderSeoAuditPdf({
    businessName: "Example & Sons",
    websiteUrl: "https://example.test/",
    createdAt: new Date("2026-09-01T06:30:00.000Z"),
    audit,
  });

  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  assert.ok(pdf.byteLength > 1_000);
  const pageCount =
    pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length ?? 0;
  assert.ok(pageCount > 0);
  assert.ok(
    pageCount <= 5,
    `expected at most five pages, received ${pageCount}`,
  );
});
