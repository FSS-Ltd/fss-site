import assert from "node:assert/strict";
import test from "node:test";
import { intersectAuthorityBounds } from "./authority-bounds";

const date = (value: number) => new Date(value);
test("intersects exclusive and inclusive authority limits without rounding", () => {
  assert.deepEqual(
    intersectAuthorityBounds(
      { validatedAt: date(1), expiresAt: date(9), validThrough: date(8) },
      { validatedAt: date(2), expiresAt: date(7), validThrough: null },
      { validatedAt: date(0), expiresAt: date(10), validThrough: date(6) },
    ),
    { validatedAt: date(2), expiresAt: date(7), validThrough: date(6) },
  );
  assert.throws(
    () =>
      intersectAuthorityBounds({
        validatedAt: date(NaN),
        expiresAt: date(1),
        validThrough: null,
      }),
    /invalid_authority_bounds/,
  );
});
