import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import type { ClientDocument } from "@/lib/operations/documents/types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { RequestList } = require("./list") as typeof import("./list");
const { RequestBoard } = require("./board") as typeof import("./board");
const { FounderActionFields } =
  require("./founder-action-fields") as typeof import("./founder-action-fields");
const { RequestDetail } =
  require("./request-detail") as typeof import("./request-detail");
const { RequestForm } =
  require("./request-form") as typeof import("./request-form");
const { FounderRequestActions } =
  require("./founder-request-actions") as typeof import("./founder-request-actions");
const router = {
  bfcacheId: "request-ui-test",
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
};
const request: ClientRequestDetail = {
  id: "4d3e1c27-3a6c-4720-a163-198ec5391220",
  projectId: "4d3e1c27-3a6c-4720-a163-198ec5391221",
  title: "Contact form",
  description: "<script>alert('unsafe')</script>",
  type: "work",
  desiredOutcome: "Receive enquiries",
  desiredDate: null,
  impact: "",
  reproductionSteps: "",
  expectedBehaviour: "",
  actualBehaviour: "",
  status: "ready_for_review",
  scope: "included",
  scopeReason: "Included in care plan",
  ownerDisplay: "FSS",
  nextAction: "Review contact form",
  targetDate: null,
  version: 4,
  reviewCycle: 1,
  deliverableVersion: "v1",
  reviewInstructions: "Check the form fields",
  publicSummary: "Added phone field",
  acknowledgementTarget: "2026-09-08T17:00:00Z",
  reviewReminderTarget: null,
  createdAt: "2026-09-07T10:00:00Z",
  blocked: null,
  closureLabel: null,
  comments: [
    {
      id: "comment",
      body: "<img src=x onerror=alert(1)>",
      authorLabel: "FSS",
      createdAt: "2026-09-07T10:00:00Z",
    },
  ],
  reviews: [],
  documents: [],
  canReview: true,
  allowance: null,
};

test("request content is escaped and the reviewer must explicitly confirm the current version", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestDetail request={request} organisationId="org" canComment />
    </AppRouterContext.Provider>,
  );
  assert.doesNotMatch(html, /<script|<img/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /I have reviewed v1 and accept this deliverable/);
  assert.match(html, /type="checkbox"[^>]*required/);
  assert.match(html, /disabled="">Accept deliverable/);
  assert.match(html, /role="status"/);
});

test("a contributor can comment but cannot submit an acceptance decision", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestDetail
        request={{ ...request, canReview: false }}
        organisationId="org"
        canComment
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Add a comment/);
  assert.doesNotMatch(html, /Accept deliverable|Send change request/);
});

test("approved allowance keeps contractual units and decision history visible", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestDetail
        request={{
          ...request,
          allowance: {
            total: 6,
            unit: "hours",
            adjustments: [
              {
                id: "adjustment",
                amount: 6,
                reason: "Approved form improvements",
                approvalReference: "Change order 04",
                createdAt: request.createdAt,
              },
            ],
          },
        }}
        organisationId="org"
        canComment={false}
        hidePortalActions
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /6 hours/);
  assert.match(html, /Approved form improvements/);
  assert.match(html, /Change order 04/);
  assert.doesNotMatch(html, /Accept deliverable|Add a comment/);
});

test("list navigation carries organisation context and status is readable without colour", () => {
  const html = renderToStaticMarkup(
    <RequestList requests={[request]} organisationId="client & partner" />,
  );
  assert.match(html, /organisationId=client%20%26%20partner/);
  assert.match(html, /Ready for review/);
  assert.match(html, /Target: To be agreed/);
});

test("creation labels required inputs and does not expose uploads or persisted drafts", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestForm
        organisationId="org"
        projects={[{ id: request.projectId, title: "Website" }]}
      />
    </AppRouterContext.Provider>,
  );
  for (const name of ["title", "description", "desiredOutcome"])
    assert.match(
      html,
      new RegExp(
        `<(?:input|textarea)(?=[^>]*name="${name}")(?=[^>]*required)[^>]*>`,
      ),
    );
  assert.match(html, /Do not paste passwords/);
  assert.match(html, /File uploads are not available yet/);
  assert.doesNotMatch(html, /type="file"/);
  assert.doesNotMatch(html, /Operational priority|name="priority"/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length);
});

test("founder state changes use a keyboard-accessible select and never offer client acceptance", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <FounderRequestActions
        request={request}
        organisationId="org"
        deliveryOwners={[]}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /<select/);
  assert.match(html, /Update scope decision/);
  assert.match(html, /Close administratively/);
  assert.match(html, /Set operational priority/);
  assert.doesNotMatch(html, /Accept deliverable|value="accept"/);
});

test("founder priority uses a labelled native choice with the current value", () => {
  const html = renderToStaticMarkup(
    <FounderActionFields
      action="set_priority"
      deliveryOwners={[]}
      agreements={[]}
      currentPriority="high"
    />,
  );
  assert.match(html, /Operational priority<select name="priority"/);
  assert.match(html, /<option value="high" selected="">High/);
  for (const value of ["low", "normal", "high", "urgent"])
    assert.match(html, new RegExp(`<option value="${value}"`));
  assert.match(html, /Internal delivery priority/);
});

test("request and history limits are explicit without implying filters cover older records", () => {
  const board = renderToStaticMarkup(
    <RequestBoard requests={[request]} organisationId="org" />,
  );
  assert.match(board, /up to 100 recent requests/);
  assert.match(board, /filters apply to these displayed requests/);
  const history: ClientRequestDetail = {
    ...request,
    comments: Array.from({ length: 200 }, (_, index) => ({
      ...request.comments[0],
      id: `comment-${index}`,
    })),
    reviews: Array.from({ length: 200 }, (_, index) => ({
      id: `review-${index}`,
      reviewCycle: 1,
      deliverableVersion: "v1",
      decision: "requested",
      feedback: "",
      createdAt: request.createdAt,
      documentIds: [],
      documents: [],
    })),
  };
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestDetail
        request={history}
        organisationId="org"
        canComment={false}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /latest 200 comments/);
  assert.match(html, /latest 200 review entries/);
});

test("review documents stay with their version and only authorised projections become links", () => {
  const oldDocument: ClientDocument = {
    id: "old-document",
    projectId: request.projectId,
    title: "Original form v1",
    kind: "link",
    url: "https://example.com/review-v1",
  };
  const currentDocument: ClientDocument = {
    id: "current-document",
    projectId: request.projectId,
    title: "Revised form v2",
    kind: "link",
    url: "https://example.com/review-v2",
  };
  const history: ClientRequestDetail = {
    ...request,
    deliverableVersion: "v2",
    reviewCycle: 2,
    documents: [currentDocument],
    reviews: [
      {
        id: "review-1",
        reviewCycle: 1,
        deliverableVersion: "v1",
        decision: "requested",
        feedback: "",
        createdAt: request.createdAt,
        documentIds: [oldDocument.id, "revoked-document"],
        documents: [oldDocument],
      },
      {
        id: "decision-1",
        reviewCycle: 1,
        deliverableVersion: "v1",
        decision: "changes_requested",
        feedback: "Add a phone field",
        createdAt: request.createdAt,
        documentIds: [oldDocument.id],
        documents: [oldDocument],
      },
      {
        id: "review-2",
        reviewCycle: 2,
        deliverableVersion: "v2",
        decision: "requested",
        feedback: "",
        createdAt: request.createdAt,
        documentIds: [currentDocument.id],
        documents: [currentDocument],
      },
    ],
  };
  const render = (hidePortalActions: boolean): string =>
    renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>
        <RequestDetail
          request={history}
          organisationId="org"
          canComment={false}
          hidePortalActions={hidePortalActions}
        />
      </AppRouterContext.Provider>,
    );
  const html = render(false);
  const historyStart = html.indexOf('aria-labelledby="review-history-heading"');
  assert.ok(historyStart > 0);
  assert.doesNotMatch(
    html.slice(0, historyStart),
    /Original form v1|review-v1/,
  );
  assert.match(html.slice(0, historyStart), /Revised form v2/);
  assert.equal(
    (html.match(/href="https:\/\/example.com\/review-v1"/g) ?? []).length,
    1,
  );
  assert.doesNotMatch(html, /revoked-document/);
  const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(
    new Set(ids).size,
    ids.length,
    "each document section has a unique accessible heading",
  );
  const founderHtml = render(true);
  assert.match(founderHtml, /Original form v1/);
  assert.match(founderHtml, /Revised form v2/);
  assert.doesNotMatch(
    founderHtml,
    /href="https:\/\/example.com\/review-v[12]"/,
  );
});
