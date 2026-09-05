import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";

import { GET } from "@/app/social/[...path]/route";

test("social image routes return actual 1200x630 PNGs for home, pages and articles", async () => {
  for (const path of [
    ["home"],
    ["services"],
    ["blog", "sdk-integration-playbook"],
    ["resources", "manual-process-audit-fss"],
  ]) {
    const response = await GET(
      new Request(`https://faithfulsoftware.dev/social/${path.join("/")}`),
      { params: Promise.resolve({ path }) },
    );
    assert.equal(response.status, 200);
    assert.match(response.headers.get("content-type") ?? "", /image\/png/);
    const metadata = await sharp(
      Buffer.from(await response.arrayBuffer()),
    ).metadata();
    assert.equal(metadata.width, 1200);
    assert.equal(metadata.height, 630);
  }
});

test("unknown and private routes cannot generate public social images", async () => {
  for (const path of [
    ["missing"],
    ["growth"],
    ["blog", ".."],
    ["resources", "manual-process-audit-fss", "thank-you"],
  ]) {
    const response = await GET(
      new Request("https://faithfulsoftware.dev/social/missing"),
      { params: Promise.resolve({ path }) },
    );
    assert.equal(response.status, 404);
  }
});
