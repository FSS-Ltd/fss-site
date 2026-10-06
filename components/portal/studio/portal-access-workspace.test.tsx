import assert from "node:assert/strict";
import Module, { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_, key) => String(key) }),
  };
};
const navigationPath = require.resolve("next/navigation");
const navigation = new Module(navigationPath);
navigation.exports = { useRouter: () => ({ refresh: () => undefined }) };
navigation.loaded = true;
require.cache[navigationPath] = navigation;
const { PortalAccessWorkspace } =
  require("./portal-access-workspace") as typeof import("./portal-access-workspace");

test("renders client access controls without leaking provider activation URLs", () => {
  const html = renderToStaticMarkup(
    <PortalAccessWorkspace
      data={{
        view: "clients",
        canManageStaff: false,
        metrics: {
          activeClientUsers: 41,
          activeStaff: 0,
          pendingInvitations: 12,
          attentionInvitations: 3,
        },
        contacts: [
          {
            email: "a***@northstar.example",
            id: "44444444-4444-4444-8444-444444444444",
            name: "Alex Morgan",
            organisationId: "55555555-5555-4555-8555-555555555555",
            organisationName: "Northstar",
          },
        ],
        hasNext: false,
        items: [
          {
            accessType: "client",
            joinedAt: "2026-09-20T10:00:00.000Z",
            contactId: "44444444-4444-4444-8444-444444444444",
            email: "alex@northstar.example",
            expiresAt: null,
            id: "membership:66666666-6666-4666-8666-666666666666",
            invitedAt: "2026-09-20T10:00:00.000Z",
            lastVerifiedAt: "2026-09-20T10:00:00.000Z",
            membershipId: "66666666-6666-4666-8666-666666666666",
            name: "Alex Morgan",
            organisationId: "55555555-5555-4555-8555-555555555555",
            organisationName: "Northstar",
            role: "owner",
            state: "active",
          },
          {
            accessType: "client",
            joinedAt: null,
            contactId: null,
            email: "sam@example.test",
            expiresAt: "2026-09-21T10:00:00.000Z",
            id: "client-invitation:77777777-7777-4777-8777-777777777777",
            invitedAt: "2026-09-20T10:00:00.000Z",
            lastVerifiedAt: null,
            membershipId: null,
            name: "Sam Example",
            organisationId: null,
            organisationName: null,
            role: "owner",
            state: "accepted",
          },
        ],
        page: 1,
        query: "",
        state: null,
        totalPages: 1,
      }}
    />,
  );
  assert.match(html, /People and portal access/);
  assert.match(html, /Active client users/);
  assert.match(html, /Invitations needing attention/);
  assert.match(html, /<dialog/);
  assert.match(html, /Provider acceptance/);
  assert.match(html, /Accepted, awaiting onboarding/);
  assert.match(html, /Next step/);
  assert.match(html, /Create organisation/);
  assert.doesNotMatch(html, /Expires/);
  assert.doesNotMatch(html, /Invite FSS staff/);
  assert.match(html, /aria-current="page"/);
  assert.match(html, /Remove access/);
  assert.doesNotMatch(html, /activationUrl/);
});

test("empty founder dashboard offers scoped invitations and hides removal controls", () => {
  const html = renderToStaticMarkup(
    <PortalAccessWorkspace
      data={{
        contacts: [],
        items: [],
        hasNext: false,
        page: 1,
        query: "",
        state: null,
        totalPages: 1,
        view: "staff",
        canManageStaff: true,
        metrics: {
          activeClientUsers: 0,
          activeStaff: 0,
          pendingInvitations: 0,
          attentionInvitations: 0,
        },
      }}
    />,
  );
  assert.match(html, /Invite FSS staff/);
  assert.match(html, /No access records yet/);
  assert.match(html, /Existing client user/);
  assert.doesNotMatch(html, /Confirm removal/);
  assert.match(html, /Operations access across client organisations/);
});

test("client invitation stays available when there are no contacts", () => {
  const html = renderToStaticMarkup(
    <PortalAccessWorkspace
      data={{
        contacts: [],
        items: [],
        hasNext: false,
        page: 1,
        query: "",
        state: null,
        totalPages: 1,
        view: "clients",
        canManageStaff: false,
        metrics: {
          activeClientUsers: 0,
          activeStaff: 0,
          pendingInvitations: 0,
          attentionInvitations: 0,
        },
      }}
    />,
  );
  assert.match(html, /Invite client/);
  assert.match(html, /New client owner/);
  assert.match(html, /Existing client user/);
  assert.match(html, /<option[^>]*disabled[^>]*>Existing client user/);
  assert.match(html, /create their organisation during onboarding/);
});

test("filtered empty dashboard preserves filters, page and independent totals", () => {
  const html = renderToStaticMarkup(
    <PortalAccessWorkspace
      data={{
        contacts: [],
        items: [],
        hasNext: true,
        page: 2,
        query: "nobody",
        state: "expired",
        totalPages: 3,
        view: "invitations",
        canManageStaff: false,
        metrics: {
          activeClientUsers: 40,
          activeStaff: 0,
          pendingInvitations: 10,
          attentionInvitations: 6,
        },
      }}
    />,
  );
  assert.match(html, /No matching people/);
  assert.match(html, /Clear filters/);
  assert.match(html, /Page 2/);
  assert.match(html, /Page 2 of 3/);
  assert.match(html, /page=1&amp;view=invitations/);
  assert.match(html, /page=3&amp;view=invitations/);
  assert.match(html, /page=1&amp;view=clients/);
  assert.match(html, /view=invitations/);
  assert.match(html, /state=expired/);
  assert.match(html, /value="nobody"/);
});
