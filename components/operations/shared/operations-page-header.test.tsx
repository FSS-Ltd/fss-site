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

test("inverse header marks enterprise dashboard headers for accessible contrast", () => {
  const html = renderToStaticMarkup(
    <OperationsPageHeader
      context="Growth · Operations"
      title="Operations"
      description="Contract revenue and client actions."
      variant="inverse"
    />,
  );

  assert.match(html, /data-variant="inverse"/);
});
