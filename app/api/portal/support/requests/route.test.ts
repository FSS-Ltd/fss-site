import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("support requests fail closed before identity or database access", async () => {
  const saved = process.env.OPERATIONS_ENABLED;
  try {
    process.env.OPERATIONS_ENABLED = "false";
    const response = await POST(
      new Request("https://example.test/api/portal/support/requests", {
        method: "POST",
      }),
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  } finally {
    if (saved === undefined) delete process.env.OPERATIONS_ENABLED;
    else process.env.OPERATIONS_ENABLED = saved;
  }
});
