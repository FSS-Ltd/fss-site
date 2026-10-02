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

const { StudioClientForm } =
  require("./client-form") as typeof import("./client-form");

test("client form explains its scoped, non-invitation save action", () => {
  const html = renderToStaticMarkup(<StudioClientForm />);

  assert.match(html, /Add a client/);
  assert.match(html, /Primary contact/);
  assert.match(html, /Creates the client record only/);
  assert.match(html, /Save client/);
  assert.doesNotMatch(html, /Send invitation/);
});

test("new client form uses applied Studio timezone without rewriting entered defaults", () => {
  const html = renderToStaticMarkup(
    <StudioClientForm defaultTimezone="America/New_York" />,
  );
  assert.match(html, /name="timezone"[^>]*value="America\/New_York"/);
});

test("client form offers supported billing currencies with GBP selected", () => {
  const html = renderToStaticMarkup(<StudioClientForm />);
  assert.match(html, /Billing currency/);
  assert.match(html, /name="billingCurrency"/);
  assert.match(html, /value="GBP" selected=""/);
  assert.match(html, /value="USD"/);
  assert.match(html, /value="EUR"/);
  assert.match(html, /British pound \(GBP\)/);
  assert.match(html, /US dollar \(USD\)/);
  assert.match(html, /Euro \(EUR\)/);
});
