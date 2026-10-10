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

const { AgreementStatusCard, toPortalAgreementStatus } =
  require("./presentation") as typeof import("./presentation");

test("maps an approved agreement with outstanding signatures to awaiting signature", () => {
  assert.equal(
    toPortalAgreementStatus({
      allRequiredSignaturesRecorded: false,
      status: "approved",
    }),
    "awaiting_signature",
  );
});

test("maps a completed agreement with every signature to signed", () => {
  assert.equal(
    toPortalAgreementStatus({
      allRequiredSignaturesRecorded: true,
      status: "completed",
    }),
    "signed",
  );
});

test("shows signed document processing after every signature is recorded", () => {
  assert.equal(
    toPortalAgreementStatus({
      allRequiredSignaturesRecorded: true,
      status: "approved",
    }),
    "processing",
  );
});

test("does not present incomplete signature evidence as signed", () => {
  assert.equal(
    toPortalAgreementStatus({
      allRequiredSignaturesRecorded: false,
      status: "completed",
    }),
    "awaiting_signature",
  );
});

test("does not label an agreement awaiting signature as signed", () => {
  const html = renderToStaticMarkup(
    <AgreementStatusCard status="awaiting_signature" />,
  );

  assert.match(html, /Awaiting signature/);
  assert.doesNotMatch(html, /Signed and complete/);
});
