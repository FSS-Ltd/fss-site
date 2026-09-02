import assert from "node:assert/strict";
import Module from "node:module";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { SeoAuditReviewData } from "@/lib/growth/dashboard/seo-audits";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const moduleWithInternals = Module as unknown as {
  _load: (request: string, ...rest: unknown[]) => unknown;
};
const originalLoad = moduleWithInternals._load;
moduleWithInternals._load = function (request, ...rest) {
  if (request === "next/navigation") {
    return { useRouter: () => ({ refresh: () => undefined }) };
  }
  return originalLoad.call(this, request, ...rest);
};
const { SeoAuditActions } =
  require("./seo-audit-actions") as typeof import("./seo-audit-actions");
moduleWithInternals._load = originalLoad;

function audit(
  overrides: Partial<SeoAuditReviewData> = {},
): SeoAuditReviewData {
  return {
    auditId: "11111111-1111-4111-8111-111111111111",
    version: 2,
    status: "draft",
    businessName: "Example & Sons",
    websiteUrl: "https://example.test/",
    contactName: "Sam Example",
    contactEmail: "sam@example.test",
    reportUrl: "https://example.test/audit.pdf",
    completedAt: "2026-09-02T07:00:00.000Z",
    scheduledFor: "2026-09-11T09:00:00.000Z",
    email: {
      subject: "A practical SEO audit",
      html: "<p>Hi Sam</p>",
      text: "Hi Sam",
      wordCount: 142,
    },
    audit: {
      executiveSummary:
        "The website needs clearer local service information and customer answers.",
      scores: {
        technicalSeo: 50,
        onPageSeo: 50,
        localSeo: 50,
        answerEngineReadiness: 50,
      },
      strengths: ["The service information is understandable."],
      findings: [],
      answerEngineSummary: "Use clearer customer answers.",
      sources: [],
    },
    eligibility: { ready: true, reasons: [] },
    ...overrides,
  };
}

test("confirms an approved audit instead of presenting approval as blocked", () => {
  const html = renderToStaticMarkup(
    <SeoAuditActions
      data={audit({
        status: "approved",
        eligibility: {
          ready: false,
          reasons: ["This audit draft is no longer awaiting approval."],
        },
      })}
    />,
  );

  assert.match(html, /This audit email is approved and queued for Day 11\./);
  assert.doesNotMatch(html, /Approval is blocked until these are resolved:/);
  assert.doesNotMatch(html, /Approve for Day 11 queue/);
});
