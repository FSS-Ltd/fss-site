import assert from "node:assert/strict";
import test from "node:test";

import type { GrowthDb } from "../db/types";

import {
  createStoredSeoAuditDraft,
  parseStoredSeoAuditDraft,
  type SeoAuditSubmission,
} from "./schema";
import { regenerateSeoAuditReports } from "./report-regeneration";

const auditId = "11111111-1111-4111-8111-111111111111";
const oldReportUrl = "https://blob.example.test/old-audit.pdf";
const oldReportSha256 = "a".repeat(64);
const completedAt = new Date("2026-09-01T06:30:00.000Z");

function submission(): SeoAuditSubmission {
  return {
    auditId,
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
          checkedAt: completedAt.toISOString(),
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

function createTestDb() {
  const stored = createStoredSeoAuditDraft({
    submission: submission(),
    reportUrl: oldReportUrl,
    reportSha256: oldReportSha256,
  });
  let row = {
    auditId,
    version: stored.version,
    status: "draft",
    outputSnapshot: stored as unknown,
    reportUrl: oldReportUrl,
    reportSha256: oldReportSha256,
    completedAt,
    businessName: "Example & Sons",
    websiteUrl: "https://example.test/",
  };
  const statements: string[] = [];
  const query = Object.assign(
    async (strings: TemplateStringsArray, ...values: unknown[]) => {
      const statement = strings.join("?").replace(/\s+/g, " ").trim();
      statements.push(statement);
      if (statement.startsWith("select")) return [row];
      if (statement.startsWith("update growth.seo_audit_drafts")) {
        const regenerated = values[0];
        row = {
          ...row,
          outputSnapshot: regenerated,
          reportUrl: values[1] as string,
          reportSha256: values[2] as string,
          version: values[3] as number,
        };
        return [{ id: auditId }];
      }
      if (statement.startsWith("insert into growth.audit_log")) return [];
      throw new Error(`Unexpected SQL: ${statement}`);
    },
    {
      begin: async <T>(operation: (transaction: unknown) => Promise<T>) =>
        operation(query),
      json: <T>(value: T) => value,
    },
  );

  return { db: query as unknown as GrowthDb, getRow: () => row, statements };
}

test("replaces a draft report while preserving its review snapshot and approval email", async () => {
  const { db, getRow, statements } = createTestDb();
  const deletedUrls: string[] = [];
  const generated = await regenerateSeoAuditReports({
    db,
    auditIds: [auditId],
    correlationId: "correlation-1",
    now: new Date("2026-09-01T07:00:00.000Z"),
    renderPdf: async () => Buffer.from("%PDF-fixed-audit", "ascii"),
    blobStorage: {
      putReport: async ({ pathname, bytes }) => {
        assert.match(
          pathname,
          new RegExp(`^growth-seo-audits/${auditId}/audit-`),
        );
        assert.equal(Buffer.from(bytes).toString("ascii"), "%PDF-fixed-audit");
        return { url: "https://blob.example.test/fixed-audit.pdf" };
      },
      deleteReport: async (url) => {
        deletedUrls.push(url);
      },
    },
  });

  assert.equal(generated, 1);
  const row = getRow();
  assert.equal(row.version, 2);
  assert.equal(row.reportUrl, "https://blob.example.test/fixed-audit.pdf");
  const regenerated = parseStoredSeoAuditDraft(row.outputSnapshot);
  assert.equal(regenerated.version, 2);
  assert.match(regenerated.email.html, /fixed-audit\.pdf/);
  assert.doesNotMatch(regenerated.email.html, /old-audit\.pdf/);
  assert.match(regenerated.email.text, /fixed-audit\.pdf/);
  assert.deepEqual(deletedUrls, [oldReportUrl]);
  assert.equal(
    statements.some((statement) =>
      statement.startsWith("insert into growth.audit_log"),
    ),
    true,
  );
});
