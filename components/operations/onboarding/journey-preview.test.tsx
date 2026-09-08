import test from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { createRequire } from "node:module";
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
