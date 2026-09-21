import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "./route";

test("mark-read requests fail closed before checking identity or opening a database", async () => {
  const saved = process.env.OPERATIONS_ENABLED;
  try {
    process.env.OPERATIONS_ENABLED = "false";
    const response = await POST(
      new Request(
        "https://example.test/api/portal/notifications/mark-read?organisationId=11111111-1111-4111-8111-111111111111",
        { method: "POST" },
      ),
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  } finally {
    if (saved === undefined) delete process.env.OPERATIONS_ENABLED;
    else process.env.OPERATIONS_ENABLED = saved;
  }
});
