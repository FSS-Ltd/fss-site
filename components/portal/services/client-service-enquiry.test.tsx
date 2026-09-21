import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { Offer } from "@/lib/operations/offers/types";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { ClientServiceCatalogue } =
  require("./client-service-catalogue") as typeof import("./client-service-catalogue");
const { ClientServiceEnquiry } =
  require("./client-service-enquiry") as typeof import("./client-service-enquiry");

const organisationId = "11111111-1111-4111-8111-111111111111";
const offer: Offer = {
  audience: "Teams that need focused ongoing support.",
  exclusions: ["New product features"],
  id: "33333333-3333-4333-8333-333333333333",
  inclusions: ["Maintenance", "Agreed support"],
  name: "Website care",
  outcome: "Keep your website useful after launch.",
  pricePence: null,
  pricingDisplay: "quote",
  recurrence: null,
  setupNeeds: [],
  supportHours: "Weekday support hours apply.",
};

test("keeps service exploration separate from a purchase", () => {
  const html = renderToStaticMarkup(
    <ClientServiceCatalogue
      canEnquire
      offers={[offer]}
      organisationId={organisationId}
    />,
  );

  assert.match(html, /A conversation first/);
  assert.match(
    html,
    /It does not activate a service or charge your payment method/,
  );
  assert.match(html, /Ask about Website care/);
});

test("collects a bounded service enquiry with an optional preferred start", () => {
  const html = renderToStaticMarkup(
    <ClientServiceEnquiry
      contactEmail="alex@northstar.example"
      offer={offer}
      organisationId={organisationId}
    />,
  );

  assert.match(html, /What would you like help with/);
  assert.match(html, /Preferred start/);
  assert.match(html, /alex@northstar\.example/);
  assert.match(html, /FSS will review your enquiry/);
  assert.doesNotMatch(html, /type="file"/);
});
