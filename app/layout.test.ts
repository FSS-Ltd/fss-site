import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";

const require = createRequire(import.meta.url);

require.extensions[".css"] = (module) => {
  module.exports = {};
};

const { metadata } = require("./layout") as { metadata?: unknown };

test("declares the FSS brand icon for browser tabs", () => {
  assert.deepEqual(metadata, {
    icons: {
      icon: "/icon.PNG",
    },
  });
});

test("does not retain the default Next.js favicon", () => {
  assert.equal(existsSync(new URL("./favicon.ico", import.meta.url)), false);
});
