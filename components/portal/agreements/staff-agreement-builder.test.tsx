import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { agreementDraft } from "@/lib/operations/agreements/fixtures";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { StaffAgreementBuilder } =
  require("./staff-agreement-builder") as typeof import("./staff-agreement-builder");

const organisationId = "11111111-1111-4111-8111-111111111111";
const engagementId = "22222222-2222-4222-8222-222222222222";

function renderBuilder(
  engagements: readonly { id: string; name: string }[],
  initialDraft: Parameters<
    typeof StaffAgreementBuilder
  >[0]["initialDraft"] = null,
) {
  return renderToStaticMarkup(
    <StaffAgreementBuilder
      baseHref={`/portal/admin/clients/${organisationId}/agreements/new`}
      commandEndpoint={`/api/portal/admin/clients/${organisationId}/agreement-drafts`}
      engagementHref={`/portal/admin/clients/${organisationId}/engagements/new`}
      engagements={engagements}
      initialDraft={initialDraft}
      onNavigate={() => undefined}
      organisationName="Northstar Studio"
    />,
  );
}

test("the link step presents reviewed work and a saved-draft continuation", () => {
  const html = renderBuilder([
    {
      id: engagementId,
      name: "Website & booking experience · Discovery complete",
    },
  ]);

  assert.match(html, /Link the right work/);
  assert.match(html, /Discovery complete/);
  assert.match(html, />Continue<svg/);
  assert.match(html, /data-builder-group="1" hidden/);
  assert.doesNotMatch(html, /New agreement<\/legend>/);
});

test("the no-engagement state preserves the draft and directs users to reviewed work", () => {
  const html = renderBuilder([]);

  assert.match(html, /No engagement is linked/);
  assert.match(html, /Your draft stays saved/);
  assert.match(html, /Create engagement/);
  assert.doesNotMatch(html, /<option value="[0-9a-f-]{36}/);
});

test("a server-loaded saved draft opens at its persisted builder step", () => {
  const html = renderBuilder([], {
    content: {
      agreement: {
        goals: "Make booking easier.",
        responsibilities: "Supply approved copy.",
        scope: "Build the booking flow.",
        support: "Support follows the agreed term.",
        terms: "Customer accounts are not included.",
      },
      engagementId,
    },
    createdAt: "2026-09-21T18:00:00.000Z",
    engagementId,
    id: "33333333-3333-4333-8333-333333333333",
    organisationId,
    step: "scope",
    updatedAt: "2026-09-21T18:05:00.000Z",
    version: 2,
  });

  assert.match(html, /Define the work/);
  assert.match(html, />Continue<svg/);
  assert.match(html, /data-builder-group="1" hidden/);
  assert.doesNotMatch(html, /Link the right work/);
});

test("the review step does not claim that creating an agreement also prepares signing", () => {
  const html = renderBuilder([], {
    content: {
      agreement: { title: "Website & booking experience" },
      engagementId,
    },
    createdAt: "2026-09-21T18:00:00.000Z",
    engagementId,
    id: "33333333-3333-4333-8333-333333333333",
    organisationId,
    step: "review",
    updatedAt: "2026-09-21T18:05:00.000Z",
    version: 2,
  });

  assert.match(html, />Create agreement</);
  assert.doesNotMatch(html, /Create agreement &amp; prepare signing/);
});

for (const mode of ["client_proposed", "revenue_share"] as const) {
  test(`review describes ${mode} recurring services without a zero-price promise`, () => {
    const html = renderBuilder([], {
      content: {
        engagementId,
        agreement: {
          currency: "GBP",
          title: "Recurring support",
          lines: [
            {
              description: "Support",
              serviceCode: "support",
              quantity: 1,
              unitPence: "0",
              discountPence: "0",
              taxPence: "0",
              recurrenceMonths: 1,
              startDate: "2026-10-01",
              endDate: null,
            },
          ],
        },
        commercialOffer: {
          expiresAt: "2026-11-01T00:00:00.000Z",
          spec: {
            cash:
              mode === "client_proposed" ? { mode: "client_proposed" } : null,
            revenueShare:
              mode === "revenue_share"
                ? {
                    mode: "fixed",
                    percentageBps: 1000,
                    revenueSource: "Bookings",
                    calculationBasis: "Gross revenue",
                    duration: "One year",
                    reportingRequirements: "Monthly report",
                    paymentTerms: "Monthly settlement",
                  }
                : null,
          },
        },
      },
      id: "33333333-3333-4333-8333-333333333333",
      organisationId,
      engagementId,
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
      step: "review",
      version: 2,
    });
    assert.doesNotMatch(html, /£0\.00 every/);
    assert.match(
      html,
      mode === "client_proposed"
        ? /Support: Amount proposed by client/
        : /Support: Covered by revenue share/,
    );
  });
}

test("review lists the missing recurring work, blocks publication and offers a Fees repair", () => {
  const { documentHash, documentReference, ...agreement } = agreementDraft();
  assert.ok(documentHash && documentReference);
  const html = renderBuilder([], {
    id: "33333333-3333-4333-8333-333333333333",
    organisationId,
    engagementId,
    content: {
      agreement,
      engagementId,
      commercialOffer: {
        spec: { cash: { mode: "client_proposed" }, revenueShare: null },
        expiresAt: "2026-11-01T00:00:00.000Z",
      },
    },
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    step: "review",
    version: 1,
  });
  assert.match(html, /Client-proposed amounts apply to recurring services/);
  assert.match(html, /Edit fees/);
  assert.match(html, /<button[^>]*disabled=""[^>]*>Publish payment offer/);
});
