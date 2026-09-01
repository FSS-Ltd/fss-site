import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import type { GrowthDb } from "../db/types";

import {
  createSeoAuditClaimHandler,
  createSeoAuditSubmissionHandler,
} from "./agent-route-handler";
import type { SeoAuditBlobStorage } from "./blob";
import type { SeoAuditCandidate } from "./repository";
import type { StoredSeoAuditDraft } from "./schema";

const SECRET = "a-secure-test-secret-that-is-longer-than-thirty-two-characters";
const NOW = new Date("2026-09-01T06:30:00.000Z");
const AUDIT_ID = "11111111-1111-4111-8111-111111111111";

const blobStorage: SeoAuditBlobStorage = {
  putReport: async () => ({ url: "https://example.test/reports/audit.pdf" }),
  deleteReport: async () => undefined,
};

function dependencies() {
  return {
    db: {} as GrowthDb,
    agentKeyId: "seo-audit-agent-v1",
    agentHmacSecret: SECRET,
    createCorrelationId: () => "correlation-1",
    now: () => NOW,
    blobStorage,
    reportUnexpectedError: () => assert.fail("Unexpected route error."),
  };
}

function signedRequest(path: string, body: unknown): Request {
  const rawBody = JSON.stringify(body);
  const timestamp = String(Math.floor(NOW.getTime() / 1_000));
  const signature = createHmac("sha256", SECRET)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest("hex");
  return new Request(`https://faithfulsoftware.dev${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-fss-key-id": "seo-audit-agent-v1",
      "x-fss-timestamp": timestamp,
      "x-fss-signature": signature,
    },
    body: rawBody,
  });
}

function auditSubmission() {
  const finding = (id: string) => ({
    id,
    severity: "high" as const,
    title: `Improve ${id.replaceAll("-", " ")}`,
    evidence:
      "The public pages do not consistently provide a direct, locally relevant answer before asking the customer to contact the business.",
    whyItMatters:
      "Clear answers help search and answer engines connect the business to the specific questions that local customers use before they enquire.",
    actions: [
      {
        title: "Update the page copy",
        instructions:
          "Add a direct answer near the top of the relevant page, then explain the service area and the next action a customer should take.",
      },
    ],
  });
  return {
    auditId: AUDIT_ID,
    audit: {
      executiveSummary:
        "The website already communicates a credible service, but clearer local service answers and practical FAQs would make it easier for customers and answer engines to understand the offer.",
      scores: {
        technicalSeo: 61,
        onPageSeo: 48,
        localSeo: 57,
        answerEngineReadiness: 38,
      },
      strengths: [
        "The existing service copy uses language that a customer can understand without specialist knowledge.",
      ],
      findings: [
        finding("titles"),
        finding("service-faqs"),
        finding("local-pages"),
        finding("business-profile"),
      ],
      answerEngineSummary:
        "Publish concise service answers and frequently asked questions using the wording customers use in calls, then keep that information consistent across the site and business profile.",
      sources: [
        {
          title: "Website homepage",
          url: "https://example.test/",
          checkedAt: "2026-09-01T06:30:00.000Z",
        },
      ],
    },
    email: {
      subject: "A practical SEO audit for your team",
      paragraphs: [
        "Hi Sam, I reviewed the public pages for Example & Sons after my earlier notes. I found a few practical changes your team can make without touching the codebase.",
        "The report focuses on service-page clarity, local visibility and the questions answer engines need a business to explain plainly. I hope it is useful whether we speak or not.",
      ],
    },
  };
}

test("returns only the scoped candidate fields after a signed claim", async () => {
  const candidate: SeoAuditCandidate = {
    auditId: AUDIT_ID,
    sequenceEnrollmentId: "22222222-2222-4222-8222-222222222222",
    businessName: "Example & Sons",
    websiteUrl: "https://example.test/",
    sector: "Home services",
    locality: "Canterbury",
    contactFirstName: "Sam",
  };
  const handler = createSeoAuditClaimHandler({
    ...dependencies(),
    claimCandidates: async (limit) => {
      assert.equal(limit, 3);
      return [candidate];
    },
  });

  const response = await handler(
    signedRequest("/api/agent/seo-audits/claim", { limit: 3 }),
  );
  const payload = (await response.json()) as {
    ok: boolean;
    candidates: SeoAuditCandidate[];
  };

  assert.equal(response.status, 200);
  assert.deepEqual(payload.candidates, [candidate]);
});

test("renders a PDF and persists a review-only draft after a signed submission", async () => {
  const state: { stored: StoredSeoAuditDraft | null } = { stored: null };
  let uploadedPath: string | null = null;
  const handler = createSeoAuditSubmissionHandler({
    ...dependencies(),
    getRenderContext: async () => ({
      auditId: AUDIT_ID,
      status: "claimed",
      claimExpiresAt: new Date("2026-09-01T08:30:00.000Z"),
      businessName: "Example & Sons",
      websiteUrl: "https://example.test/",
    }),
    renderPdf: async () => Buffer.from("%PDF-test"),
    blobStorage: {
      ...blobStorage,
      putReport: async ({ pathname }) => {
        uploadedPath = pathname;
        return { url: "https://example.test/reports/audit.pdf" };
      },
    },
    completeDraft: async (input) => {
      state.stored = input.outputSnapshot;
    },
  });

  const response = await handler(
    signedRequest("/api/agent/seo-audits", auditSubmission()),
  );

  assert.equal(response.status, 201);
  assert.match(uploadedPath ?? "", /^growth-seo-audits\//);
  assert.equal(state.stored?.reviewState, "draft");
  assert.match(
    state.stored?.email.text ?? "",
    /full SEO and answer-engine audit/i,
  );
});

test("rejects a submission with an invalid signature before it reaches the agent workflow", async () => {
  const handler = createSeoAuditSubmissionHandler(dependencies());
  const request = signedRequest("/api/agent/seo-audits", auditSubmission());
  request.headers.set("x-fss-signature", "0".repeat(64));

  const response = await handler(request);

  assert.equal(response.status, 401);
});

test("rejects an under-length email before it renders a report", async () => {
  let renderAttempted = false;
  const handler = createSeoAuditSubmissionHandler({
    ...dependencies(),
    renderPdf: async () => {
      renderAttempted = true;
      return Buffer.from("%PDF-test");
    },
  });
  const submission = auditSubmission();
  submission.email.paragraphs = [
    "I reviewed the public pages and found a few practical opportunities.",
    "The attached report explains where to start with the work.",
  ];

  const response = await handler(
    signedRequest("/api/agent/seo-audits", submission),
  );

  assert.equal(response.status, 422);
  assert.equal(renderAttempted, false);
});
