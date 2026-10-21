import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import { agreementDraft } from "@/lib/operations/agreements/fixtures";
import type { CommercialOffer } from "@/lib/operations/agreements/commercial-types";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};
const { ClientCommercialOffer } =
  require("./client-commercial-offer") as typeof import("./client-commercial-offer");
const { StaffCommercialOffer } =
  require("./staff-commercial-offer") as typeof import("./staff-commercial-offer");
const { CommercialOfferFields } =
  require("./commercial-offer-fields") as typeof import("./commercial-offer-fields");
const { CommercialOfferList } =
  require("./commercial-offer-list") as typeof import("./commercial-offer-list");
const offer: CommercialOffer = {
  id: "11111111-1111-4111-8111-111111111111",
  organisationId: "22222222-2222-4222-8222-222222222222",
  engagementId: "33333333-3333-4333-8333-333333333333",
  version: 1,
  status: "published",
  recordedStatus: "published",
  draft: { ...agreementDraft(), currency: "EUR" },
  spec: {
    cash: { mode: "client_proposed" },
    revenueShare: {
      mode: "client_proposed",
      revenueSource: "Product sales",
      calculationBasis: "Received revenue",
      duration: "24 months",
      reportingRequirements: "Monthly",
      paymentTerms: "14 days",
    },
  },
  expiresAt: "2026-11-01T00:00:00Z",
  selection: null,
  rejectionReason: null,
  approvalId: null,
  agreementId: null,
};

function render(element: React.JSX.Element): string {
  const router = {
    bfcacheId: "commercial-test",
    back: () => undefined,
    forward: () => undefined,
    refresh: () => undefined,
    push: () => undefined,
    replace: () => undefined,
    prefetch: async () => undefined,
  };
  return renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      {element}
    </AppRouterContext.Provider>,
  );
}
test("client offer keeps setup fees distinct and never preselects compensation", () => {
  const html = render(<ClientCommercialOffer offer={offer} />);
  assert.match(html, /€120\.00/);
  assert.match(html, /minimum 20 EUR/);
  assert.match(html, /minimum 10%/);
  assert.match(html, /type="radio"/);
  assert.doesNotMatch(html, /checked=""/);
});
test("pending proposals cannot be selected again and rejection has a reason", () => {
  const html = render(
    <ClientCommercialOffer offer={{ ...offer, status: "proposed" }} />,
  );
  assert.match(html, /Awaiting FSS review/);
  assert.doesNotMatch(html, /type="radio"/);
  const rejected = render(
    <ClientCommercialOffer
      offer={{
        ...offer,
        status: "rejected",
        rejectionReason: "Please review the scope",
      }}
    />,
  );
  assert.match(rejected, /Please review the scope/);
});

test("expired client proposals retain the submitted budget and only offer deadline actions", () => {
  const html = render(
    <StaffCommercialOffer
      offer={{
        ...offer,
        status: "expired",
        recordedStatus: "proposed",
        selection: { option: "cash", recurringAmountMinor: "2000" },
      }}
    />,
  );
  assert.match(html, /€20\.00 EUR per month/);
  assert.match(html, /Deadline expired: extend or withdraw/);
  assert.match(html, /Extend deadline/);
  assert.match(html, /Withdraw proposal/);
  assert.doesNotMatch(html, /Approve and send for signing/);
  assert.doesNotMatch(html, /Reject proposal/);
});

test("agreement register labels expired staff offers with the deadline action", () => {
  const html = render(
    <CommercialOfferList
      audience="staff"
      offers={[{ ...offer, status: "expired" }]}
    />,
  );
  assert.match(html, /Deadline expired: extend or withdraw/);
  assert.match(html, /Extend or withdraw/);
});
test("share fields are opt-in and identify their contractual basis", () => {
  const disabled = render(
    <CommercialOfferFields
      spec={{ cash: { mode: "fixed" }, revenueShare: null }}
      currency="USD"
      onChange={() => undefined}
    />,
  );
  assert.doesNotMatch(disabled, /name="revenueSource"/);
  const enabled = render(
    <CommercialOfferFields
      spec={offer.spec}
      currency="EUR"
      onChange={() => undefined}
    />,
  );
  assert.match(enabled, /name="revenueSource"/);
  assert.match(enabled, /name="offerExpiresAt"/);
});
