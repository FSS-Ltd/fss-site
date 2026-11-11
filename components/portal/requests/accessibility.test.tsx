import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { ClientRequestDetail } from "@/lib/operations/requests/types";
import type { ClientDocument } from "@/lib/operations/documents/types";
import type { StaffDeliveryBoardRequest } from "@/lib/operations/requests/staff-repository";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { RequestList } = require("./list") as typeof import("./list");
const { RequestBoard, RequestBoardSkeleton } =
  require("./board") as typeof import("./board");
const { FounderActionFields } =
  require("./founder-action-fields") as typeof import("./founder-action-fields");
const { RequestDetail } =
  require("./request-detail") as typeof import("./request-detail");
const { ReviewActions } =
  require("./review-actions") as typeof import("./review-actions");
const { RequestForm } =
  require("./request-form") as typeof import("./request-form");
const { FounderRequestActions } =
  require("./founder-request-actions") as typeof import("./founder-request-actions");
const { StaffDeliveryBoard } =
  require("./staff-delivery-board") as typeof import("./staff-delivery-board");
const { StaffRequestActions } =
  require("./staff-request-actions") as typeof import("./staff-request-actions");
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
  closureReason: null,
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
const staffRequest: StaffDeliveryBoardRequest = {
  blocked: false,
  createdAt: request.createdAt,
  id: request.id,
  nextAction: request.nextAction,
  organisationId: "org",
  organisationName: "Northstar Studio",
  ownerDisplay: "Jean-Fidele",
  priority: "normal",
  scope: "included",
  status: "in_progress",
  targetDate: request.targetDate,
  title: request.title,
  version: request.version,
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
  assert.match(html, /disabled="">Accept v1/);
  assert.match(html, /role="status"/);
  assert.match(html, /Does this meet the agreed outcome\?/);
  assert.match(html, /What changed/);
  assert.match(html, /Accept v1/);
  assert.match(html, /Request changes/);
});

test("a completed request distinguishes client acceptance from an FSS closure", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestDetail
        request={{
          ...request,
          status: "done",
          reviews: [
            {
              createdAt: request.createdAt,
              decision: "accepted",
              deliverableVersion: "v1",
              documentIds: [],
              documents: [],
              feedback: "",
              id: "accepted-review",
              reviewCycle: 1,
            },
          ],
        }}
        organisationId="org"
        canComment={false}
      />
    </AppRouterContext.Provider>,
  );

  assert.match(html, /Version v1 accepted/);
  assert.match(html, /Start a follow-up request/);

  const closureHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestDetail
        request={{
          ...request,
          closureLabel: "Closed by FSS",
          closureReason: "The client cancelled the agreed work.",
          status: "done",
        }}
        organisationId="org"
        canComment={false}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(closureHtml, /The client cancelled the agreed work/);
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
  assert.doesNotMatch(html, /Accept v1|Send feedback/);
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
  assert.doesNotMatch(html, /Accept v1|Add a comment/);
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
  const selectedProjectId = "4d3e1c27-3a6c-4720-a163-23b20af2bb6c";
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

  const preselectedHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestForm
        initialProjectId={selectedProjectId}
        organisationId="org"
        projects={[
          { id: request.projectId, title: "Website" },
          { id: selectedProjectId, title: "Booking flow" },
        ]}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(
    preselectedHtml,
    new RegExp(
      `<option value="${selectedProjectId}" selected="">Booking flow</option>`,
    ),
  );
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
  assert.doesNotMatch(html, /Accept v1|value="accept"/);
});

test("founder delivery exposes a move control and separates review and public update work", () => {
  const boardHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <StaffDeliveryBoard
        clients={[{ id: "org", displayName: "Northstar Studio" }]}
        filters={{ organisationId: "all", status: "all" }}
        requests={[staffRequest]}
      />
    </AppRouterContext.Provider>,
  );
  const actionsHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <StaffRequestActions
        initialAction="review"
        deliveryOwners={[{ id: "owner", label: "Jean-Fidele" }]}
        organisationId="org"
        request={{ ...request, status: "in_progress" }}
      />
    </AppRouterContext.Provider>,
  );
  const publicUpdateHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <StaffRequestActions
        initialAction="public_update"
        deliveryOwners={[{ id: "owner", label: "Jean-Fidele" }]}
        organisationId="org"
        request={{ ...request, status: "in_progress" }}
      />
    </AppRouterContext.Provider>,
  );

  assert.match(boardHtml, /Move to/);
  assert.match(actionsHtml, /Review package/);
  assert.match(actionsHtml, /Public update/);
  assert.match(actionsHtml, /Add or retain a deliverable/);
  assert.match(publicUpdateHtml, /Message to client/);
  assert.match(publicUpdateHtml, /client portal/);
  assert.doesNotMatch(actionsHtml, /Accept v1/);
});

test("founder request scope and move-sheet states retain server-validated work", () => {
  const scopeHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <StaffRequestActions
        initialAction="classify_scope"
        deliveryOwners={[{ id: "owner", label: "Jean-Fidele" }]}
        organisationId="org"
        request={{ ...request, status: "new" }}
      />
    </AppRouterContext.Provider>,
  );
  const moveHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <StaffDeliveryBoard
        clients={[{ id: "org", displayName: "Northstar Studio" }]}
        filters={{ organisationId: "all", status: "all" }}
        initialMoveRequestId={staffRequest.id}
        requests={[staffRequest]}
      />
    </AppRouterContext.Provider>,
  );

  assert.match(scopeHtml, /Scope decision/);
  assert.match(scopeHtml, /Scope explanation/);
  assert.match(moveHtml, /Nothing has moved yet/);
  assert.match(moveHtml, /Open request workspace/);
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
  assert.match(html, /<label[^>]*>Operational priority/);
  assert.match(html, /<select[^>]*name="priority"/);
  assert.match(html, /<option value="high" selected="">High/);
  for (const value of ["low", "normal", "high", "urgent"])
    assert.match(html, new RegExp(`<option value="${value}"`));
  assert.match(html, /Internal delivery priority/);
});

test("request filters describe server-paged results and retain native controls", () => {
  const board = renderToStaticMarkup(
    <RequestBoard
      filters={{ query: "", status: undefined }}
      requests={[request]}
      organisationId="org"
    />,
  );
  assert.match(board, /1 request in this view/);
  assert.match(board, /<form/);
  assert.match(board, /name="query"/);
  assert.match(board, /name="status"/);
  assert.match(board, /All states/);
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

test("request collection provides an actionable empty board and clear board guidance", () => {
  const board = renderToStaticMarkup(
    <RequestBoard
      filters={{ query: "", status: undefined }}
      requests={[request]}
      organisationId="org"
    />,
  );
  const emptyBoard = renderToStaticMarkup(
    <RequestBoard
      filters={{ query: "", status: undefined }}
      requests={[]}
      organisationId="org"
    />,
  );
  const loadingBoard = renderToStaticMarkup(<RequestBoardSkeleton />);

  assert.match(board, /How your board works/);
  assert.match(board, /Ready for review/);
  assert.match(emptyBoard, /Nothing in your board yet/);
  assert.match(emptyBoard, /Create first request/);
  assert.match(emptyBoard, /href="\/portal\/requests\/new\?organisationId=org"/);
  assert.match(emptyBoard, /href="\/portal\/requests\/new\?organisationId=org&amp;type=bug"/);
  assert.match(loadingBoard, /Loading your requests/);
  assert.match(loadingBoard, /aria-busy="true"/);
  assert.match(loadingBoard, /role="status"/);
});

test("request creation exposes the no-project recovery and bug-report fields", () => {
  const noProjectHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestForm organisationId="org" projects={[]} />
    </AppRouterContext.Provider>,
  );
  const bugHtml = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestForm
        initialType="bug"
        organisationId="org"
        projects={[{ id: request.projectId, title: "Website" }]}
      />
    </AppRouterContext.Provider>,
  );

  assert.match(noProjectHtml, /A project is needed for this request/);
  assert.match(noProjectHtml, /Ask FSS to set up your project/);
  assert.match(noProjectHtml, /href="\/portal\/help\?organisationId=org"/);
  assert.match(bugHtml, /Steps to reproduce/);
  assert.match(bugHtml, /What happened instead/);
});

test("request detail keeps review decisions on the dedicated review route", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <RequestDetail
        request={request}
        organisationId="org"
        canComment
        showReviewActions={false}
      />
    </AppRouterContext.Provider>,
  );

  assert.match(html, /Review v1/);
  assert.doesNotMatch(html, /Accept v1|Send feedback/);
});

test("review feedback starts selected and presents conflict recovery without serializing a draft", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <ReviewActions
        request={request}
        commandAction={async () => ({
          ok: false,
          conflict: true,
          error: "This request has changed.",
        })}
        initialDecision="request_changes"
        initialConflict
        onRefresh={() => {}}
      />
    </AppRouterContext.Provider>,
  );

  assert.match(html, /What needs changing\?/);
  assert.match(html, /Review the latest version/);
  assert.doesNotMatch(html, /name="feedback"[^>]*value=/);
});

test("staff request creation starts scope assessment without exposing client controls", () => {
  let StaffRequestForm:
    | ((props: {
        clients: Array<{
          id: string;
          displayName: string;
          projects: Array<{ id: string; title: string }>;
        }>;
      }) => React.JSX.Element)
    | undefined;
  try {
    StaffRequestForm = (require("./staff-request-form") as {
      StaffRequestForm?: typeof StaffRequestForm;
    }).StaffRequestForm;
  } catch {
    StaffRequestForm = undefined;
  }
  assert.equal(typeof StaffRequestForm, "function");
  if (!StaffRequestForm) return;

  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <StaffRequestForm
        clients={[
          {
            id: "org",
            displayName: "Northstar Studio",
            projects: [{ id: request.projectId, title: "Website" }],
          },
        ]}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Assessment pending/);
  assert.doesNotMatch(html, /Included scope/);
  assert.doesNotMatch(html, /Accept v1|Add a comment/);
});
