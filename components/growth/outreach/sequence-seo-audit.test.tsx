import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import type { SequenceSeoAudit as SequenceSeoAuditState } from "@/lib/growth/dashboard/outreach";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { SequenceSeoAudit } =
  require("./sequence-seo-audit") as typeof import("./sequence-seo-audit");

function render(audit: SequenceSeoAuditState): string {
  return renderToStaticMarkup(<SequenceSeoAudit audit={audit} />);
}

test("links directly to an audit that is ready for founder approval", () => {
  const html = render({
    state: "draft",
    auditId: "11111111-1111-4111-8111-111111111111",
    completedAt: "2026-09-01T12:00:00.000Z",
  });

  assert.match(html, /Review audit/);
  assert.match(
    html,
    /href="\/growth\/outreach\/audits\/11111111-1111-4111-8111-111111111111"/,
  );
});

test("explains a claimed audit without presenting a false approval action", () => {
  const html = render({
    state: "claimed",
    claimExpiresAt: "2026-09-01T14:46:10.085Z",
  });

  assert.match(html, /The audit is being prepared\./);
  assert.match(html, /retried after/);
  assert.doesNotMatch(html, /Review audit/);
});
