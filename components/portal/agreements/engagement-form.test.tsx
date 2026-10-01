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

test("shows reviewed engagement fields and a selectable existing engagement", () => {
  const html = renderToStaticMarkup(
    <EngagementForm
      agreementHref="/admin/clients/example/agreements"
      commandEndpoint="/api/portal/admin/clients/example/engagements"
      draft={null}
      engagementChoices={[
        {
          id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          name: "Website & booking experience · Discovery complete",
        },
      ]}
      onComplete={() => undefined}
      organisationName="Northstar Studio"
    />,
  );

  assert.match(html, /Primary goal/);
  assert.match(html, /Proposed scope/);
  assert.match(html, /Reviewed source or reference/);
  assert.match(html, /I have reviewed this work/);
  assert.match(html, /Create &amp; continue to agreement/);
  assert.match(html, /Use this engagement/);
  assert.match(html, /Discovery complete/);
  assert.doesNotMatch(html, /growth\/pipeline/);
});

test("offers a cancel destination while retaining a versioned agreement draft", () => {
  const agreementHref =
    "/portal/admin/clients/example/agreements/new?draftId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  const html = renderToStaticMarkup(
    <EngagementForm
      agreementHref={agreementHref}
      commandEndpoint="/api/portal/admin/clients/example/engagements"
      draft={{ id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", version: 3 }}
      engagementChoices={[]}
      onComplete={() => undefined}
      organisationName="Northstar Studio"
    />,
  );

  assert.match(html, /Cancel and return/);
  assert.match(html, /draftId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa/);
  assert.match(html, /name="reviewed"/);
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
