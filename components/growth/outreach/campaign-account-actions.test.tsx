import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { CampaignAccount } from "@/lib/growth/dashboard/campaign-accounts";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { CampaignAccountActions, ResendSetupAction } =
  require("./campaign-account-actions") as typeof import("./campaign-account-actions");
const router = {
  back() {},
  forward() {},
  refresh() {},
  push() {},
  replace() {},
  prefetch() {},
  bfcacheId: "test",
};
const account: CampaignAccount = {
  id: "a",
  provider: "gmail",
  sender: "founder@example.com",
  selectable: true,
  evidenceVersion: 1,
  grantRevalidation: null,
  readiness: { status: "held", reason: "account_not_active" },
  recordedRamp: 25,
  limitsEvidence: null,
  healthEvidence: null,
  usageObservation: null,
  control: {
    state: "paused",
    version: 2,
    ramp: 25,
    prerequisites: { status: "held", reason: "health_unknown" },
    advance: null,
  },
};

test("held readiness explains the missing evidence and offers explicit halt", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignAccountActions account={account} />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Activation held: health unknown/);
  assert.match(html, /Reason for halt/);
  assert.match(html, /Halt account/);
  assert.doesNotMatch(html, /Activate account/);
});

test("actual ready prerequisites expose activation and explicit server-bound setup", () => {
  const ready: CampaignAccount = {
    ...account,
    control: {
      state: "paused",
      version: 2,
      ramp: 25,
      prerequisites: { status: "ready" },
      advance: null,
    },
  };
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignAccountActions account={ready} />
      <ResendSetupAction
        setup={{
          status: "available",
          sender: "sender@example.com",
          expectedVersion: 0,
        }}
      />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Activate account/);
  assert.match(html, /does not activate a campaign/);
  assert.match(html, /sender@example.com/);
  assert.match(html, /Review Resend configuration/);
  assert.doesNotMatch(html, /credential|secret/i);
});

test("ramp advancement appears only when its own review passes", () => {
  const active: CampaignAccount = {
    ...account,
    control: {
      state: "active",
      version: 3,
      ramp: 25,
      prerequisites: { status: "ready" },
      advance: {
        next: 50,
        readiness: { status: "held", reason: "health_review_reused" },
      },
    },
  };
  const held = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignAccountActions account={active} />
    </AppRouterContext.Provider>,
  );
  assert.match(held, /Ramp advance held: health review reused/);
  assert.doesNotMatch(held, /Approve ramp to 50/);
  const ready: CampaignAccount = {
    ...active,
    control: {
      state: "active",
      version: 3,
      ramp: 25,
      prerequisites: { status: "ready" },
      advance: { next: 50, readiness: { status: "ready" } },
    },
  };
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <CampaignAccountActions account={ready} />
    </AppRouterContext.Provider>,
  );
  assert.match(html, /Approve ramp to 50/);
});

test("evidence forms disclose unknowns and use provider-specific fields", () => {
  const { CampaignAccountEvidence } =
    require("./campaign-account-evidence") as typeof import("./campaign-account-evidence");
  const render = (value: CampaignAccount) =>
    renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>
        <CampaignAccountEvidence account={value} />
      </AppRouterContext.Provider>,
    );
  const gmail = render(account);
  assert.match(gmail, /Record Gmail limits and visibility evidence/);
  assert.match(gmail, /SPF status/);
  assert.match(gmail, /blank if unknown/);
  assert.match(gmail, /Recording evidence does not activate sending/);
  const resend = render({ ...account, provider: "resend" });
  assert.doesNotMatch(resend, /Record Gmail limits/);
  assert.match(resend, /Record health and authentication evidence/);
  assert.match(
    render({ ...account, evidenceVersion: null }),
    /Evidence entry is held/,
  );
});
