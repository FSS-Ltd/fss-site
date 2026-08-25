import assert from "node:assert/strict";
import test from "node:test";

import { requireGrowthDatabaseUrl } from "./require-growth-database-env";

test("requires a PostgreSQL integration database URL", () => {
  assert.throws(
    () => requireGrowthDatabaseUrl(undefined),
    /DIRECT_DATABASE_URL is required/,
  );
  assert.throws(
    () => requireGrowthDatabaseUrl("   "),
    /DIRECT_DATABASE_URL is required/,
  );
  assert.throws(
    () => requireGrowthDatabaseUrl("https://example.test"),
    /DIRECT_DATABASE_URL must use postgres or postgresql/,
  );
  assert.throws(
    () => requireGrowthDatabaseUrl("not-a-url"),
    /DIRECT_DATABASE_URL must be a valid PostgreSQL URL/,
  );
});

test("accepts a PostgreSQL integration database URL without exposing it", () => {
  const value = "postgresql://growth:secret@example.test:5432/growth";

  assert.equal(requireGrowthDatabaseUrl(value), value);
});
