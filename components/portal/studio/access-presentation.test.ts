import assert from "node:assert/strict";
import test from "node:test";
import { accessDate } from "./access-presentation";

test("access dates use the applied Studio timezone across a day boundary", () => {
  const value = "2026-01-01T23:30:00.000Z";
  assert.equal(accessDate(value, "Europe/London"), "1 Jan 2026");
  assert.equal(accessDate(value, "Asia/Tokyo"), "2 Jan 2026");
});
