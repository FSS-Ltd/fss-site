import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { StudioClientCurrencyForm } =
  require("./client-currency-form") as typeof import("./client-currency-form");

test("currency setting displays the saved selection, reviewed reason and historical currency boundary", () => {
  const html = renderToStaticMarkup(
    <StudioClientCurrencyForm
      billingCurrency="EUR"
      currencyVersion={3}
      organisationId="44444444-4444-4444-8444-444444444444"
    />,
  );
  assert.match(html, /value="EUR" selected=""/);
  assert.match(html, /name="billingCurrency"/);
  assert.match(html, /Review reference/);
  assert.match(html, /required="" name="reviewReference"/);
  assert.match(html, /Save currency/);
  assert.match(
    html,
    /Existing drafts, agreements, schedules and invoices keep their recorded currency/,
  );
  assert.doesNotMatch(html, /Convert/);
});
