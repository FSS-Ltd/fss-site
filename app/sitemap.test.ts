import assert from "node:assert/strict";
import test from "node:test";

import sitemap from "./sitemap";

test("does not publish private prospect previews in the public sitemap", async () => {
  const entries = await sitemap();

  assert.equal(
    entries.some((entry) => entry.url.includes("/preview/")),
    false,
  );
});
