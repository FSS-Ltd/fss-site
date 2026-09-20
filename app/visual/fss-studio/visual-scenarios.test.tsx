import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { resolveVisualScenario } = require(
  "./[scenario]/visual-scenarios",
) as typeof import("./[scenario]/visual-scenarios");

test("never exposes visual fixtures unless the non-production test gate is enabled", () => {
  assert.equal(resolveVisualScenario("client-overview", false, "development"), null);
  assert.equal(resolveVisualScenario("client-overview", true, "production"), null);
  assert.equal(
    resolveVisualScenario("client-overview", true, "development")?.name,
    "client-overview",
  );
});
