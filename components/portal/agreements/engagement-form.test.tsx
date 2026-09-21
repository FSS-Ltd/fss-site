import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import type { AppRouterInstance } from "next/dist/shared/lib/app-router-context.shared-runtime";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { EngagementForm } =
  require("./engagement-form") as typeof import("./engagement-form");
const { SignatureEvidenceForm } =
  require("./signature-evidence-form") as typeof import("./signature-evidence-form");
const { AppRouterContext } =
  require("next/dist/shared/lib/app-router-context.shared-runtime") as typeof import("next/dist/shared/lib/app-router-context.shared-runtime");

const router: AppRouterInstance = {
  back: () => undefined,
  bfcacheId: "test-router",
  forward: () => undefined,
  prefetch: () => undefined,
  push: () => undefined,
  refresh: () => undefined,
  replace: () => undefined,
};

test("shows reviewed provenance instead of accepting a free-form engagement", () => {
  const html = renderToStaticMarkup(
    <EngagementForm
      agreementHref="/admin/clients/example/agreements"
      engagementChoices={[
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Website & booking experience · Discovery complete",
        },
      ]}
    />,
  );

  assert.match(html, /Review status/);
  assert.match(html, /Discovery complete/);
  assert.doesNotMatch(html, /<input[^>]*name="engagement"/);
});

test("labels manual signature evidence without claiming provider verification", () => {
  const html = renderToStaticMarkup(
    <AppRouterContext.Provider value={router}>
      <SignatureEvidenceForm
        organisationId="bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
        record={{
          draft: {
            documentHash: "a".repeat(64),
            signatories: ["alex@northstar.example"],
          },
          id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          revision: 2,
          version: 3,
        }}
      />
    </AppRouterContext.Provider>,
  );

  assert.match(html, /Fingerprints are checked/);
  assert.match(html, /Manual review is distinct from provider verification/);
  assert.doesNotMatch(html, /cryptographic signature verified/i);
});
