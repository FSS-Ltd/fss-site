import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { SettingsData } from "@/lib/growth/dashboard/settings";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { IntegrationHealth } =
  require("./integration-health") as typeof import("./integration-health");
const { GmailOAuthNotice } =
  require("./gmail-oauth-notice") as typeof import("./gmail-oauth-notice");
const { AutomationControlsFrame } =
  require("./automation-controls") as typeof import("./automation-controls");

function baseData(overrides: Partial<SettingsData> = {}): SettingsData {
  return {
    databaseAvailable: true,
    gmail: {
      configured: true,
      status: "disconnected",
      accountIdentity: null,
      grantedScopes: [],
      lastSuccessAt: null,
      lastErrorCode: null,
    },
    resend: {
      configured: true,
      fromEmail: "hello@faithfulsoftware.dev",
      replyToEmail: "j.ntagengwa@faithfulsoftware.dev",
    },
    vercelBlobConfigured: true,
    codexConfigured: false,
    automation: {
      automationsEnabled: true,
      activeSequenceCount: 3,
      crons: [
        {
          path: "/api/cron/outreach-dispatch",
          label: "Outreach email dispatch",
          scheduleDescription: "Every 5 minutes",
          nextRunAt: "2026-08-21T10:05:00.000Z",
        },
      ],
    },
    checkedAt: "2026-08-21T10:03:00.000Z",
    ...overrides,
  };
}

test("GmailOAuthNotice shows safe callback feedback and ignores unknown values", () => {
  const connected = renderToStaticMarkup(
    <GmailOAuthNotice status="connected" />,
  );
  const failed = renderToStaticMarkup(
    <GmailOAuthNotice status="provider_error" />,
  );
  const unknown = renderToStaticMarkup(
    <GmailOAuthNotice status="provider-secret-detail" />,
  );

  assert.match(connected, /Gmail connected successfully/);
  assert.match(connected, /role="status"/);
  assert.match(failed, /Google did not return the access Growth OS requires/);
  assert.match(failed, /role="alert"/);
  assert.equal(unknown, "");
});

test("IntegrationHealth shows Gmail setup guidance and no scope chips or actions when not configured", () => {
  const html = renderToStaticMarkup(
    <IntegrationHealth
      data={baseData({
        gmail: {
          configured: false,
          status: "disconnected",
          accountIdentity: null,
          grantedScopes: [],
          lastSuccessAt: null,
          lastErrorCode: null,
        },
      })}
    />,
  );
  assert.match(html, /GOOGLE_GMAIL_CLIENT_ID/);
  assert.doesNotMatch(html, /Connect Gmail/);
  assert.doesNotMatch(html, /Disconnect Gmail/);
});

test("IntegrationHealth shows a Connect Gmail link when configured but not connected", () => {
  const html = renderToStaticMarkup(<IntegrationHealth data={baseData()} />);
  assert.match(html, /href="\/api\/integrations\/gmail\/connect"/);
  assert.match(html, />Connect Gmail</);
  assert.doesNotMatch(html, /Disconnect Gmail/);
});

test("IntegrationHealth shows the account identity, scopes, last sync, and a Disconnect form once Gmail is connected", () => {
  const html = renderToStaticMarkup(
    <IntegrationHealth
      data={baseData({
        gmail: {
          configured: true,
          status: "connected",
          accountIdentity: "founder@faithfulsoftware.dev",
          grantedScopes: ["gmail.send", "gmail.readonly"],
          lastSuccessAt: "2026-08-21T09:50:00.000Z",
          lastErrorCode: null,
        },
      })}
    />,
  );
  assert.match(html, /founder@faithfulsoftware\.dev/);
  assert.match(html, /gmail\.send/);
  assert.match(html, /gmail\.readonly/);
  assert.match(
    html,
    /<form action="\/api\/integrations\/gmail\/disconnect" method="post">/,
  );
  assert.match(html, />Disconnect Gmail</);
  assert.doesNotMatch(html, /href="\/api\/integrations\/gmail\/connect"/);
});

test("IntegrationHealth surfaces the last error category without any raw provider error text", () => {
  const html = renderToStaticMarkup(
    <IntegrationHealth
      data={baseData({
        gmail: {
          configured: true,
          status: "revoked",
          accountIdentity: null,
          grantedScopes: [],
          lastSuccessAt: null,
          lastErrorCode: "provider_revocation_unconfirmed",
        },
      })}
    />,
  );
  assert.match(html, /Provider revocation unconfirmed/);
});

test("IntegrationHealth shows setup guidance for Resend when it is not configured", () => {
  const html = renderToStaticMarkup(
    <IntegrationHealth
      data={baseData({
        resend: { configured: false, fromEmail: null, replyToEmail: null },
      })}
    />,
  );
  assert.match(html, /RESEND_API_KEY/);
  assert.doesNotMatch(html, />Not configured<\/span>[\s\S]*hello@/);
});

test("IntegrationHealth lists the from/reply-to addresses once Resend is configured", () => {
  const html = renderToStaticMarkup(<IntegrationHealth data={baseData()} />);
  assert.match(html, /hello@faithfulsoftware\.dev/);
  assert.match(html, /j\.ntagengwa@faithfulsoftware\.dev/);
});

test("IntegrationHealth shows the next scheduled run for each cron while automations are enabled", () => {
  const html = renderToStaticMarkup(<IntegrationHealth data={baseData()} />);
  assert.match(html, /Outreach email dispatch/);
  assert.match(html, /Every 5 minutes/);
  assert.match(html, /Next/);
});

test("IntegrationHealth omits the next-run time once automations are disabled", () => {
  const html = renderToStaticMarkup(
    <IntegrationHealth
      data={baseData({
        automation: {
          automationsEnabled: false,
          activeSequenceCount: 0,
          crons: [
            {
              path: "/api/cron/outreach-dispatch",
              label: "Outreach email dispatch",
              scheduleDescription: "Every 5 minutes",
              nextRunAt: null,
            },
          ],
        },
      })}
    />,
  );
  assert.doesNotMatch(html, /Next/);
});

function render(automation: SettingsData["automation"]): string {
  return renderToStaticMarkup(
    <AutomationControlsFrame automation={automation} onSuccess={() => {}} />,
  );
}

test("AutomationControlsFrame shows the active sequence count and an enabled pause button", () => {
  const html = render(baseData().automation);
  assert.match(html, />3<\/span>/);
  assert.doesNotMatch(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Pause all active sequences\s*<\/button>/,
  );
});

test("AutomationControlsFrame disables the pause button when there is nothing to pause", () => {
  const html = render({ ...baseData().automation, activeSequenceCount: 0 });
  assert.match(
    html,
    /<button[^>]*disabled=""[^>]*>\s*Pause all active sequences\s*<\/button>/,
  );
});

test("AutomationControlsFrame explains it cannot touch the Vercel environment flag", () => {
  const html = render(baseData().automation);
  assert.match(html, /GROWTH_OS_AUTOMATIONS_ENABLED/);
  assert.match(html, /Vercel project settings/);
});
