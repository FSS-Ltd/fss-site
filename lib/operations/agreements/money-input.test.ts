import assert from "node:assert/strict";
import test from "node:test";

import { gbpToPence, penceToGbp } from "./money-input";

test("GBP form inputs convert to exact pence without floating-point rounding", () => {
  for (const [amount, pence] of [
    ["0", "0"],
    ["0.01", "1"],
    ["1.2", "120"],
    ["123.45", "12345"],
    [" 001.20 ", "120"],
    ["9999999999999999.99", "999999999999999999"],
  ]) {
    assert.equal(gbpToPence(amount), pence);
    assert.equal(gbpToPence(penceToGbp(pence)), pence);
  }
  assert.equal(penceToGbp("1"), "0.01");
  assert.equal(penceToGbp("100"), "1.00");
  assert.equal(penceToGbp("1000000000000000000000"), "10000000000000000000.00");
});

test("money controls reject ambiguous, negative, over-precise and oversized inputs", () => {
  for (const value of [
    "",
    " ",
    "-1",
    "1.234",
    "1e3",
    "1,000",
    "£1",
    "1.",
    ".5",
    "10000000000000000",
    "NaN",
    "Infinity",
  ]) {
    assert.throws(() => gbpToPence(value), /GBP amount/);
  }
  for (const value of ["", "-1", "1.5", "01", "1".repeat(31)]) {
    assert.throws(() => penceToGbp(value), /whole pence/);
  }
});
