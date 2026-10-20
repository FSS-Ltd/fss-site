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

const { StaffAgreementOverview } =
  require("./staff-agreement-overview") as typeof import("./staff-agreement-overview");

test("groups FSS Studio agreement work by actionable status", () => {
  const html = renderToStaticMarkup(
    <StaffAgreementOverview
      agreements={[
        {
          agreementCount: 2,
          draftCount: 1,
          builderDraftCount: 2,
          commercialOfferCount: 0,
          expiredOfferCount: 0,
          organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          organisationName: "Harbour Foundation",
          signedCount: 1,
        },
      ]}
      signingReadiness={[
        {
          approvalId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          organisationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          organisationName: "Harbour Foundation",
          status: "approved",
          title: "Membership portal",
        },
      ]}
    />,
  );

  assert.match(html, /Draft &amp; awaiting signature/);
  assert.match(html, /Agreement builder drafts/);
  assert.match(html, /2 unfinished drafts/);
  assert.match(html, /Signed/);
  assert.match(html, /Continue draft/);
  assert.match(html, /Approval is not signature/);
  assert.match(html, /Awaiting signature/);
  assert.doesNotMatch(html, /Approved and queued/);
});

test("describes signed records as completed evidence rather than an approval", () => {
  const html = renderToStaticMarkup(
    <StaffAgreementOverview
      agreements={[
        {
          agreementCount: 1,
          draftCount: 0,
          builderDraftCount: 0,
          commercialOfferCount: 0,
          expiredOfferCount: 0,
          organisationId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
          organisationName: "Elm &amp; Co",
          signedCount: 1,
        },
      ]}
      signingReadiness={[]}
    />,
  );

  assert.match(html, /Signed evidence is complete/);
});

test("surfaces payment offers and expired deadlines in the agreement overview", () => {
  const html = renderToStaticMarkup(
    <StaffAgreementOverview
      agreements={[
        {
          agreementCount: 0,
          draftCount: 0,
          builderDraftCount: 0,
          commercialOfferCount: 2,
          expiredOfferCount: 1,
          organisationId: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
          organisationName: "Nina Mutamba",
          signedCount: 0,
        },
      ]}
      signingReadiness={[]}
    />,
  );

  assert.match(html, /Payment offers/);
  assert.match(html, /2 open offers/);
  assert.match(html, /1 deadline expired: extend or withdraw/);
  assert.match(html, /Review offers/);
  assert.match(html, /New agreement/);
});
