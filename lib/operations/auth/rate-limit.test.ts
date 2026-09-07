import assert from "node:assert/strict";
import test from "node:test";
import { portalRateLimitBuckets } from "./rate-limit";
test("auth limits ignore spoofable headers outside Vercel and never store raw identifiers", () => {
  const request = new Request("https://example.test", {
    headers: {
      "x-vercel-forwarded-for": "192.0.2.1",
      "x-forwarded-for": "198.51.100.1",
    },
  });
  const plain = new Request("https://example.test");
  assert.deepEqual(
    portalRateLimitBuckets(request, undefined, {}),
    portalRateLimitBuckets(plain, undefined, {}),
  );
  const buckets = portalRateLimitBuckets(request, " Client@example.test ", {
    VERCEL: "1",
  });
  assert.equal(buckets.length, 2);
  assert.notDeepEqual(
    buckets.slice(0, 1),
    portalRateLimitBuckets(plain, undefined, { VERCEL: "1" }),
  );
  assert.deepEqual(
    buckets[1],
    portalRateLimitBuckets(request, "client@example.test", { VERCEL: "1" })[1],
  );
  assert.ok(buckets.every((bucket) => /^[a-f0-9]{64}$/.test(bucket.hash)));
});
