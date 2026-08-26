import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test, { after } from "node:test";

import type Link from "next/link";
import {
  createElement,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from "react";
import { renderToStaticMarkup } from "react-dom/server";

import type { OverviewViewModel } from "@/lib/growth/dashboard/overview";
import type {
  IntegrationHealth,
  ViewState,
} from "@/lib/growth/dashboard/view-models";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const nextLinkModule = require("next/link") as {
  render: (
    props: ComponentProps<typeof Link>,
    ref: Ref<HTMLAnchorElement>,
  ) => ReactNode;
};
const originalNextLinkRender = nextLinkModule.render;
nextLinkModule.render = ({ children, href, prefetch, ...props }, ref) =>
  createElement(
    "a",
    {
      ...props,
      "data-prefetch": String(prefetch),
      href: typeof href === "string" ? href : href.pathname,
      ref,
    },
    children,
  );

const { OverviewPage } =
  require("./overview-page") as typeof import("./overview-page");
after(() => {
  nextLinkModule.render = originalNextLinkRender;
});
const overviewCss = readFileSync(
  new URL("./overview.module.css", import.meta.url),
  "utf8",
);

const NOW = "2026-08-16T08:00:00.000Z";

const healthyIntegrations: readonly IntegrationHealth[] = [
  {
    provider: "database",
    status: "healthy",
    checkedAt: NOW,
    message: "Database available",
  },
  {
    provider: "gmail",
    status: "healthy",
    checkedAt: NOW,
    message: "Gmail connected",
  },
  {
    provider: "cron",
    status: "healthy",
    checkedAt: NOW,
    message: "Automations enabled",
  },
];

const readyData: OverviewViewModel = {
  summary: {
    emailsWaitingForApproval: 6,
    repliesNeedingAttention: 3,
    followUpsDueToday: 4,
    nextResearchRunAt: "2026-08-17T05:00:00.000Z",
  },
  workQueue: [
    {
      kind: "first_emails",
      totalCount: 6,
      rows: [
        {
          prospectId: "prospect-1",
          businessName: "Smith & Sons Plumbing Ltd",
          websiteUrl: "https://smithandsonsplumbing.co.uk",
          fitScore: 91,
          offerFocus: "Website + AI Enquiry Agent",
          status: "ready_for_email_review",
          statusAt: "2026-08-15T09:00:00.000Z",
          evidenceCount: 7,
          potentialValuePence: 650_000,
          reviewHref: "/growth/outreach/messages/message-1",
          overdue: false,
        },
      ],
    },
    {
      kind: "replies",
      totalCount: 3,
      rows: [
        {
          prospectId: "prospect-2",
          businessName: "First Fix Electrical",
          websiteUrl: null,
          fitScore: 76,
          offerFocus: "Booking website",
          status: "replied",
          statusAt: "2026-08-15T08:00:00.000Z",
          evidenceCount: 3,
          potentialValuePence: 300_000,
          reviewHref: "/growth/outreach/sequences/sequence-2",
          overdue: false,
        },
      ],
    },
    {
      kind: "follow_ups",
      totalCount: 1,
      rows: [
        {
          prospectId: "prospect-3",
          businessName: "Greenfield Ltd",
          websiteUrl: null,
          fitScore: 68,
          offerFocus: "Website refresh",
          status: "contacted",
          statusAt: "2026-08-10T00:00:00.000Z",
          evidenceCount: 2,
          potentialValuePence: 200_000,
          reviewHref: "/growth/outreach/sequences/sequence-3",
          overdue: true,
        },
      ],
    },
  ],
  defaultWorkQueueTab: "follow_ups",
  pipeline: {
    totalValuePence: 1_100_000,
    stages: [
      { id: "new", label: "New", count: 7, valuePence: 420_000 },
      { id: "qualified", label: "Qualified", count: 5, valuePence: 680_000 },
      { id: "proposal", label: "Proposal", count: 0, valuePence: 0 },
      { id: "negotiation", label: "Negotiation", count: 0, valuePence: 0 },
    ],
  },
  upcomingActions: [
    {
      prospectId: "prospect-4",
      businessName: "BuildRight",
      actionLabel: "Send case study",
      status: "started_talks",
      dueAt: "2026-08-17T09:00:00.000Z",
    },
  ],
  sequenceHealth: {
    sentCount: 49,
    failedCount: 1,
    deliveryRate: 0.98,
    repliedEnrollmentCount: 8,
    sentEnrollmentCount: 50,
    replyRate: 0.16,
  },
};

function renderOverview(
  state: ViewState<OverviewViewModel>,
  integrations: readonly IntegrationHealth[] = healthyIntegrations,
): string {
  return renderToStaticMarkup(
    <OverviewPage integrations={integrations} now={NOW} state={state} />,
  );
}

test("renders the ready state with reconciled summary counts and pipeline totals", () => {
  const html = renderOverview({ status: "ready", data: readyData });

  assert.match(html, />6<\/p>/);
  assert.match(html, />Emails waiting for approval<\/p>/);
  assert.match(html, />3<\/p>/);
  assert.match(html, />Replies need attention<\/p>/);
  assert.match(html, />4<\/p>/);
  assert.match(html, />Follow-ups due today<\/p>/);
  assert.match(html, /£11,000/);
  assert.match(html, /Smith &amp; Sons Plumbing Ltd/);
});

test("does not prefetch database-backed overview destinations", () => {
  const html = renderOverview({ status: "ready", data: readyData });
  const growthLinks = html.match(/<a[^>]+href="\/growth[^>]*>/g) ?? [];

  assert.ok(growthLinks.length > 0);
  for (const link of growthLinks) {
    assert.match(link, /data-prefetch="false"/);
  }
});

test("selects the default work queue tab and shows it as the visible panel", () => {
  const html = renderOverview({ status: "ready", data: readyData });

  assert.match(html, /aria-selected="true"[^>]*>Follow-ups \(1\)/);
  assert.match(html, /aria-selected="false"[^>]*>First emails \(6\)/);
});

test("marks overdue follow-ups with visible text, not colour alone", () => {
  const html = renderOverview({ status: "ready", data: readyData });

  assert.match(html, />Overdue<\/span>/);
  assert.match(html, /data-overdue="true"/);
});

test("gives the work queue table an accessible caption", () => {
  const html = renderOverview({ status: "ready", data: readyData });

  assert.match(html, /<caption[^>]*>Follow-ups work queue<\/caption>/);
  assert.match(html, /<th scope="col">Prospect<\/th>/);
});

test("renders an empty state when there is nothing to review", () => {
  const html = renderOverview({
    status: "empty",
    reason: "No prospects yet. Research runs will populate your work queue.",
  });

  assert.match(
    html,
    /No prospects yet\. Research runs will populate your work queue\./,
  );
  assert.doesNotMatch(html, /Work queue/);
});

test("renders a safe error message with a correlation ID and no leaked detail", () => {
  const html = renderOverview({
    status: "error",
    message: "The founder dashboard could not load overview data.",
    correlationId: "11111111-1111-1111-1111-111111111111",
  });

  assert.match(html, /The founder dashboard could not load overview data\./);
  assert.match(html, /11111111-1111-1111-1111-111111111111/);
  assert.doesNotMatch(html, /select |postgres|ECONNREFUSED/i);
});

test("shows an advisory when Gmail is disconnected", () => {
  const html = renderOverview({ status: "ready", data: readyData }, [
    ...healthyIntegrations.filter(
      (integration) => integration.provider !== "gmail",
    ),
    {
      provider: "gmail",
      status: "disconnected",
      checkedAt: NOW,
      message: "Gmail not connected",
    },
  ]);

  assert.match(html, /Gmail is disconnected/);
});

test("shows an advisory when automations are disabled", () => {
  const html = renderOverview({ status: "ready", data: readyData }, [
    ...healthyIntegrations.filter(
      (integration) => integration.provider !== "cron",
    ),
    {
      provider: "cron",
      status: "disabled",
      checkedAt: NOW,
      message: "Automations disabled",
    },
  ]);

  assert.match(html, /Automations are paused/);
});

test("shows no advisory when integrations are healthy", () => {
  const html = renderOverview({ status: "ready", data: readyData });

  assert.doesNotMatch(html, /Gmail is disconnected/);
  assert.doesNotMatch(html, /Automations are paused/);
});

test("renders a mobile card list alongside the desktop table, toggled by CSS only", () => {
  const html = renderOverview({ status: "ready", data: readyData });

  assert.match(html, /<table[^>]*>/);
  assert.match(html, /class="[^"]*queueMobileList[^"]*"/);
});

test("hides the desktop table and shows queue cards below the tablet breakpoint", () => {
  assert.match(
    overviewCss,
    /@media \(max-width: 767px\)[\s\S]*?\.queueTable[\s\S]*?display: none/,
  );
  assert.match(
    overviewCss,
    /@media \(max-width: 767px\)[\s\S]*?\.queueMobileList[\s\S]*?display: flex/,
  );
});

test("stacks summary cards, the work queue, and actions before secondary analytics on narrow screens", () => {
  assert.match(
    overviewCss,
    /grid-template-areas:\s*"strip"\s*"queue"\s*"actions"\s*"pipeline"\s*"health";/,
  );
});
