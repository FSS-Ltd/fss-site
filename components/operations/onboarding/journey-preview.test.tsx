import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { WelcomeForm } =
  require("./welcome-form") as typeof import("./welcome-form");
import {
  journeyTime,
  invoiceChoices,
} from "@/lib/operations/onboarding/display";
import { agreementDraft } from "@/lib/operations/agreements/fixtures";
test("welcome form identifies FSS sender and configured billing without editable provider IDs", () => {
  const html = renderToStaticMarkup(
    <WelcomeForm
      agreements={[]}
      contacts={[]}
      billing={{ accountId: "acct_test", livemode: false }}
      pending={false}
      onPreview={() => {}}
    />,
  );
  assert.match(html, /Sender organisation: Faithful Software Solutions/);
  assert.doesNotMatch(html, /name="accountId"|name="environment"/);
  assert.match(html, /First agreed invoice/);
});
test("London scheduling handles BST and invoice choices are named obligations", () => {
  assert.equal(
    journeyTime("2026-09-08T08:00:00Z"),
    "8 Sept 2026, 09:00 London",
  );
  const choices = invoiceChoices(agreementDraft());
  assert.ok(choices.length);
  assert.match(choices[0].label, /Installment 1: £/);
  assert.equal(choices[0].value, "installment:1");
});

const { JourneyPreview } =
  require("./journey-preview") as typeof import("./journey-preview");
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime";
import type { AgreementRecord } from "@/lib/operations/agreements/types";
test("welcome preparation distinguishes missing billing from no eligible agreements", () => {
  const agreement: AgreementRecord = {
    id: "agreement",
    engagementId: "engagement",
    version: 1,
    revision: 1,
    status: "draft",
    draft: agreementDraft(),
    evidence: null,
    services: [],
  };
  const router = {
    bfcacheId: "journey-preview-test",
    back() {},
    forward() {},
    refresh() {},
    hmrRefresh() {},
    push() {},
    replace() {},
    prefetch() {},
  };
  const render = (agreements: AgreementRecord[]) =>
    renderToStaticMarkup(
      <AppRouterContext.Provider value={router}>
        <JourneyPreview
          organisationId="organisation"
          organisationName="Client Limited"
          agreements={agreements}
          contacts={[]}
          approvals={[]}
          journeys={[]}
          billing={null}
        />
      </AppRouterContext.Provider>,
    );
  const unconfigured = render([agreement]);
  assert.match(unconfigured, /Welcome and proposal have separate approvals/);
  assert.match(
    unconfigured,
    /Configure billing before preparing a welcome journey/,
  );
  assert.doesNotMatch(unconfigured, /Create an agreement/);
  const empty = render([]);
  assert.match(empty, /Create an agreement to prepare another journey/);
  assert.doesNotMatch(empty, /Configure billing before preparing/);
});

test("journey approval retains exact-recipient confirmation before either mutation", () => {
  // The approval preview appears after a server command, beyond static rendering.
  const source = readFileSync(
    new URL("./journey-preview.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /I reviewed these exact recipients, content, documents and access/,
  );
  assert.match(source, /disabled=\{pending \|\| !confirmed\}/);
  assert.match(
    source,
    /preview\.kind === "welcome" \? "start" : "approve_proposal"/,
  );
});
