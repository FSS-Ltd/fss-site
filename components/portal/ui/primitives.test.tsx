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

const {
  Notice,
  PageHeader,
  PortalButton,
  PortalField,
  StatusBadge,
} = require("./index") as typeof import("./index");

test("keeps disabled reasons labels and status names available to assistive technology", () => {
  const button = renderToStaticMarkup(
    <PortalButton disabled disabledReason="Select a project first">
      Submit request
    </PortalButton>,
  );
  const field = renderToStaticMarkup(
    <PortalField label="Request title" error="Enter a request title" required>
      <input name="title" />
    </PortalField>,
  );
  const badge = renderToStaticMarkup(
    <StatusBadge status="warning">Needs review</StatusBadge>,
  );

  assert.match(button, /disabled=""/);
  assert.match(button, /Select a project first/);
  assert.match(button, /aria-describedby=/);
  assert.match(field, /<label[^>]*>Request title/);
  assert.match(field, /Enter a request title/);
  assert.match(field, /aria-invalid="true"/);
  assert.match(field, /aria-describedby=/);
  assert.match(badge, /Warning/);
  assert.match(badge, /Needs review/);
});

test("renders named notice actions and a navigable page header", () => {
  const html = renderToStaticMarkup(
    <>
      <PageHeader
        eyebrow="Delivery"
        title="Requests"
        description="Review and respond to client work."
        breadcrumbs={[{ label: "Workspace", href: "/portal" }, { label: "Requests" }]}
        action={<PortalButton>New request</PortalButton>}
      />
      <Notice tone="warning" action={<a href="/portal/help">Get help</a>}>
        A project is required before you can submit a request.
      </Notice>
    </>,
  );

  assert.match(html, /aria-label="Breadcrumb"/);
  assert.match(html, /New request/);
  assert.match(html, /role="alert"/);
  assert.match(html, /Warning/);
  assert.match(html, /Get help/);
});
