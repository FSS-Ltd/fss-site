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

const { PortalLoginPresentation } =
  require("./login-presentation") as typeof import("./login-presentation");

test("renders the C00 sign-in surface with persistent labels and invitation context", () => {
  const html = renderToStaticMarkup(
    <PortalLoginPresentation invitationMessage="Your workspace invitation is ready">
      <label htmlFor="email">Work email</label>
      <input id="email" name="email" type="email" />
      <button type="submit">Continue</button>
    </PortalLoginPresentation>,
  );

  assert.match(html, /Sign in to FSS/);
  assert.match(html, /Work email/);
  assert.match(html, /Continue/);
  assert.match(html, /Your workspace invitation is ready/);
  assert.match(html, /Request access help/);
});
