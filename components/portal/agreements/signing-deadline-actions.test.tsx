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
const { SigningDeadlineOutcomeNotice } =
  require("./signing-deadline-actions") as typeof import("./signing-deadline-actions");

test("the deadline outcome notice survives the refresh that removes the panel", () => {
  const reopened = renderToStaticMarkup(
    <SigningDeadlineOutcomeNotice outcome="reopened" />,
  );
  assert.match(reopened, /Signing reopened/);
  assert.match(reopened, /No\s+email was sent/);
  assert.match(
    renderToStaticMarkup(<SigningDeadlineOutcomeNotice outcome="withdrawn" />),
    /Agreement withdrawn/,
  );
  for (const outcome of [undefined, "other", ["reopened", "withdrawn"]])
    assert.equal(
      renderToStaticMarkup(<SigningDeadlineOutcomeNotice outcome={outcome} />),
      "",
    );
});
