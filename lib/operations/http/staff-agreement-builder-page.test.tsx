import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import {
  AppRouterContext,
  type AppRouterInstance,
} from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import type { FssAdminContext } from "../auth/staff-types";
import { agreementDraft } from "../agreements/fixtures";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

// Replace external authentication/database boundaries, preserving the real page,
// readers, authorization transaction wrapper and rendered form components.
function stubModule<T extends object>(id: string, overrides: Partial<T>): void {
  const original = require(id) as T;
  const cached = require.cache[require.resolve(id)];
  assert.ok(cached);
  cached.exports = { ...original, ...overrides };
}

const organisationId = "44444444-4444-4444-8444-444444444444";
const engagementId = "66666666-6666-4666-8666-666666666666";
const draftId = "55555555-5555-4555-8555-555555555555";
const admin: FssAdminContext = {
  actorId: "a".repeat(64),
  correlationId: "11111111-1111-4111-8111-111111111111",
  membershipId: "22222222-2222-4222-8222-222222222222",
  userId: "33333333-3333-4333-8333-333333333333",
  realm: "staff",
  role: "admin",
};
const { documentHash, documentReference, ...agreement } = agreementDraft();
assert.ok(documentHash && documentReference);
const stored = {
  id: draftId,
  organisationId,
  engagementId,
  version: 3,
  step: "fees",
  content: {
    engagementId,
    agreement: { ...agreement, title: "Website work in progress" },
  },
  createdAt: "2026-10-01T09:00:00.000Z",
  updatedAt: "2026-10-02T20:00:00.000Z",
};
const query = async (parts: TemplateStringsArray) => {
  const sql = parts.join("?");
  if (sql.includes("list_agreement_builder_drafts"))
    return [
      {
        id: draftId,
        title: "Website work in progress",
        step: "fees",
        version: 3,
        updatedAt: stored.updatedAt,
      },
    ];
  if (sql.includes("load_agreement_builder_draft")) return [stored];
  if (sql.includes("from operations.organisations"))
    return [{ display_name: "Example Studio", billing_currency: "GBP" }];
  if (sql.includes("staff_linked_engagements"))
    return [{ id: engagementId, name: "Initial project" }];
  return [];
};
// The SQL test double implements the transaction boundary used by these readers.
const db = {
  begin: (run: (tx: OperationsTransaction) => Promise<unknown>) =>
    run(query as unknown as OperationsTransaction),
} as unknown as OperationsDb;
stubModule<typeof import("../auth/server")>("../auth/server", {
  getPortalIdentity: async () => ({
    userId: admin.userId,
    email: "admin@example.test",
    emailVerified: true,
  }),
});
stubModule<typeof import("../auth/configuration")>("../auth/configuration", {
  portalAuthConfigured: () => true,
});
stubModule<typeof import("../auth/require-admin")>("../auth/require-admin", {
  requireFssAdmin: async () => admin,
});
stubModule<typeof import("../db/client")>("../db/client", {
  operationsEnabled: () => true,
  getOperationsDb: () => db,
});
stubModule<typeof import("../db/portal-client")>("../db/portal-client", {
  getPortalDb: () => db,
});

const Page = (
  require("@/app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/new/page") as typeof import("@/app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/new/page")
).default;
const AgreementsPage = (
  require("@/app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/page") as typeof import("@/app/(portal)/(studio)/portal/admin/clients/[organisationId]/agreements/page")
).default;
const router: AppRouterInstance = {
  back: () => undefined,
  forward: () => undefined,
  refresh: () => undefined,
  push: () => undefined,
  replace: () => undefined,
  prefetch: () => undefined,
  bfcacheId: "test-route",
};
async function renderPage(
  searchParams: Parameters<typeof Page>[0]["searchParams"],
): Promise<string> {
  const element = await Page({
    params: Promise.resolve({ organisationId }),
    searchParams,
  });
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      {element}
    </AppRouterContext.Provider>,
  );
}

test("returning to New agreement offers saved drafts instead of restarting at project selection", async () => {
  const html = await renderPage(Promise.resolve({}));
  assert.match(html, /Saved agreement drafts/);
  assert.match(html, /Website work in progress/);
  assert.match(html, new RegExp(`draftId=${draftId}`));
  assert.match(html, /Continue draft/);
  assert.doesNotMatch(html, /Link the right work/);
});

test("opening a saved draft restores its persisted Fees stage and values", async () => {
  const html = await renderPage(Promise.resolve({ draftId }));
  assert.match(html, /Price the services/);
  assert.match(html, /value="Website delivery"/);
  assert.match(html, /value="100.00"/);
});

test("the client agreement register exposes working drafts separately from created records", async () => {
  const element = await AgreementsPage({
    params: Promise.resolve({ organisationId }),
    searchParams: Promise.resolve({}),
  });
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      {element}
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Saved agreement drafts/);
  assert.match(html, /Continue draft/);
});

test("Start new agreement intentionally bypasses saved drafts", async () => {
  const html = await renderPage(Promise.resolve({ new: "1" }));
  assert.match(html, /Link the right work/);
  assert.doesNotMatch(html, /Saved agreement drafts/);
  assert.match(html, /name="title" value=""/);
});

test("an ambiguous new-and-resume URL cannot select or overwrite a saved draft", async () => {
  await assert.rejects(
    renderPage(Promise.resolve({ draftId, new: "1" })),
    /NEXT_HTTP_ERROR_FALLBACK;404/,
  );
});

test("saved draft pagination preserves the agreement-record cursor and labels untitled work", () => {
  const { SavedAgreementDrafts } =
    require("@/components/portal/agreements/saved-agreement-drafts") as typeof import("@/components/portal/agreements/saved-agreement-drafts");
  const html = renderToStaticMarkup(
    <SavedAgreementDrafts
      builderHref="/admin/clients/example/agreements/new"
      listHref="/admin/clients/example/agreements?after=created-record"
      drafts={{
        page: 2,
        hasNext: true,
        items: [
          {
            id: draftId,
            title: null,
            step: "link",
            version: 1,
            updatedAt: stored.updatedAt,
          },
        ],
      }}
    />,
  );
  assert.match(html, /Untitled agreement/);
  assert.match(html, /Continue at Work/);
  assert.match(html, /after=created-record&amp;draftPage=1/);
  assert.match(html, /after=created-record&amp;draftPage=3/);
});
