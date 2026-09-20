import assert from "node:assert/strict";
import test from "node:test";
import { fssStudioUrl } from "./studio-url";

test("Studio paths use the portal origin without widening the destination", () => {
  assert.equal(
    fssStudioUrl("/admin/clients", "https://portal.example.test", true),
    "https://portal.example.test/admin/clients",
  );
  assert.equal(
    fssStudioUrl("/admin/clients", "https://portal.example.test", false),
    "https://portal.example.test/portal/admin/clients",
  );
});
