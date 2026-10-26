import assert from "node:assert/strict";
import test from "node:test";
import { moneyPence, localInstant } from "./form-values";
test("money fields preserve pennies and reject negative, excessive and malformed amounts", () => {
  for (const [text, expected] of [
    ["0", 0],
    ["12.34", 1234],
    ["99.9", 9990],
  ] as const) {
    const data = new FormData();
    data.set("value", text);
    assert.equal(moneyPence(data, "value"), expected);
  }
  for (const text of ["-1", "12.345", "no", "Infinity", "20000001"]) {
    const data = new FormData();
    data.set("value", text);
    assert.throws(() => moneyPence(data, "value"));
  }
});
test("local date-time submission requires an actual date", () => {
  assert.throws(() => localInstant("not a date"));
  assert.equal(
    Number.isNaN(Date.parse(localInstant("2026-10-28T10:00"))),
    false,
  );
});
