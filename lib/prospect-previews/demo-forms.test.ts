import assert from "node:assert/strict";
import test from "node:test";

import {
  isQuoteRequestReady,
  normalizeVehicleRegistration,
} from "./demo-forms";

test("normalizes vehicle registration input for the automotive booking journey", () => {
  assert.equal(normalizeVehicleRegistration(" ab12   cde "), "AB12 CDE");
});

test("requires the details needed for a qualified trade quote request", () => {
  assert.equal(
    isQuoteRequestReady({
      problem: "Leak",
      postcode: "TN24 8AA",
      urgency: "Today",
      name: "Alex Morgan",
      phone: "07123 456789",
    }),
    true,
  );
});

test("does not accept a trade request without contact details", () => {
  assert.equal(
    isQuoteRequestReady({
      problem: "Leak",
      postcode: "TN24 8AA",
      urgency: "Today",
      name: "Alex Morgan",
      phone: "",
    }),
    false,
  );
});
