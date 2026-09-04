import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("production builds use webpack for the configured CSS chunking strategy", () => {
  const config = readFileSync(
    new URL("../next.config.ts", import.meta.url),
    "utf8",
  );
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  assert.match(config, /cssChunking:\s*false/);
  assert.equal(manifest.scripts.build, "next build --webpack");
});
