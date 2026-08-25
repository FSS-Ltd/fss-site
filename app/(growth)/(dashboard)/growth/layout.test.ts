import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, property) => String(property) }),
  };
};

const { dynamic } = require("./layout") as typeof import("./layout");

test("keeps the founder dashboard out of build-time prerendering", () => {
  assert.equal(dynamic, "force-dynamic");
});
