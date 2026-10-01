import assert from "node:assert/strict";
import test from "node:test";
import {
  currencyLabel,
  currencySchema,
  decimalToMinor,
  formatMoney,
  minorToDecimal,
  parseStripeCurrency,
  stripeCurrency,
} from "./money";

test("supported currencies and exact minor units retain amounts without rounding", () => {
  for (const currency of ["GBP", "USD", "EUR"] as const) {
    assert.equal(currencySchema.parse(currency), currency);
    assert.ok(currencyLabel(currency).includes(`(${currency})`));
    assert.equal(parseStripeCurrency(stripeCurrency(currency)), currency);
    assert.equal(decimalToMinor("20.00"), "2000");
    assert.equal(minorToDecimal("9007199254740993"), "90071992547409.93");
    assert.ok(formatMoney("2000", currency).includes("20.00"));
  }
  assert.equal(currencySchema.safeParse("CAD").success, false);
  assert.throws(() => parseStripeCurrency("cad"));
  for (const value of ["-20", "1.001", "1e3", "", "Infinity"])
    assert.throws(() => decimalToMinor(value));
});

test("currency formatting preserves amounts above the safe integer range", () => {
  assert.equal(
    formatMoney("9007199254740993", "USD"),
    "$90,071,992,547,409.93",
  );
  assert.equal(formatMoney("1", "EUR"), "€0.01");
});
