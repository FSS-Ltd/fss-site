import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};
const { Field } = require("./form-fields") as typeof import("./form-fields");
test("composite signatory controls expose nested errors with unique accessible references", () => {
  const props = {
    label: "Signatories",
    name: "evidence.signatories",
    issues: [{ path: "evidence.signatories.0", message: "Use a valid email." }],
  };
  const html = renderToStaticMarkup(
    <>
      <Field {...props} />
      <Field {...props} />
    </>,
  );
  const ids = [...html.matchAll(/ id="([^"]+)"/g)].map((match) => match[1]);
  const descriptions = [...html.matchAll(/aria-describedby="([^"]+)"/g)].map(
    (match) => match[1],
  );
  assert.equal(ids.length, 4);
  assert.equal(new Set(ids).size, 4);
  assert.deepEqual(
    descriptions,
    ids.filter((id) => id.endsWith("-error")),
  );
  assert.equal((html.match(/aria-invalid="true"/g) ?? []).length, 2);
  assert.equal((html.match(/Use a valid email\./g) ?? []).length, 2);
});
