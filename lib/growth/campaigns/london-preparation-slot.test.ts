import assert from "node:assert/strict";
import test from "node:test";
import { isLondonPreparationSlot } from "./london-preparation-slot";

test("selects one 08:30 London occurrence across spring and autumn changes", () => {
  for (const value of [
    "2026-03-28T08:30:00Z",
    "2026-03-29T07:30:00Z",
    "2026-10-24T07:30:00Z",
    "2026-10-25T08:30:00Z",
  ])
    assert.equal(isLondonPreparationSlot(new Date(value)), true, value);
  for (const value of [
    "2026-03-28T07:30:00Z",
    "2026-03-29T08:30:00Z",
    "2026-10-24T08:30:00Z",
    "2026-10-25T07:30:00Z",
  ])
    assert.equal(isLondonPreparationSlot(new Date(value)), false, value);
});

test("accepts only the five-minute window without treating early or invalid time as due", () => {
  assert.equal(
    isLondonPreparationSlot(new Date("2026-01-05T08:29:59Z")),
    false,
  );
  assert.equal(isLondonPreparationSlot(new Date("2026-01-05T08:34:59Z")), true);
  assert.equal(
    isLondonPreparationSlot(new Date("2026-01-05T08:35:00Z")),
    false,
  );
  assert.equal(isLondonPreparationSlot(new Date(NaN)), false);
});
