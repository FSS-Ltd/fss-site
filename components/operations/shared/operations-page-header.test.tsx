import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import Link from "next/link";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { OperationsPageHeader } =
  require("./operations-page-header") as typeof import("./operations-page-header");

test("operations header provides context, outcome and optional action", () => {
  const html = renderToStaticMarkup(
    <OperationsPageHeader
      context="Operations · Billing"
      title="Needs your attention"
      description="Payment exceptions and collection decisions, ready for review."
      action={<Link href="/growth/operations/clients">Client register</Link>}
    />,
  );

  assert.match(html, /Operations · Billing/);
  assert.match(html, /Needs your attention/);
  assert.match(html, /Payment exceptions/);
  assert.match(html, /Client register/);
});
