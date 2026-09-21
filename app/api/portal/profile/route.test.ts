import assert from "node:assert/strict";
import test from "node:test";
import { PATCH } from "./route";

test("profile updates fail closed before reading a request body", async () => {
  const saved = process.env.OPERATIONS_ENABLED;
  try {
    process.env.OPERATIONS_ENABLED = "false";
    const response = await PATCH(
      new Request("https://example.test/api/portal/profile", {
        method: "PATCH",
      }),
    );
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "private, no-store");
  } finally {
    if (saved === undefined) delete process.env.OPERATIONS_ENABLED;
    else process.env.OPERATIONS_ENABLED = saved;
  }
});
