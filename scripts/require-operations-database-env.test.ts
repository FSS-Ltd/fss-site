import assert from "node:assert/strict";
import test from "node:test";

import { requireOperationsTestDatabaseUrl } from "./require-operations-database-env";

test("Operations integration tests require an explicitly named local test database", () => {
  for (const value of [
    undefined,
    "",
    "not-a-url",
    "https://localhost/fss_operations_test",
    "postgres://postgres:secret@production.example/fss_operations_test",
    "postgres://postgres:secret@localhost/postgres",
    "postgres://postgres:secret@127.0.0.1/fss_operations_test?host=production.example",
    "postgres://postgres:secret@localhost/fss_operations_test#production",
  ]) {
    assert.throws(
      () => requireOperationsTestDatabaseUrl(value),
      (error) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /OPERATIONS_TEST_DATABASE_URL/);
        assert.doesNotMatch(error.message, /secret/);
        return true;
      },
    );
  }
});

test("accepts only the local Operations and CI databases", () => {
  for (const value of [
    "postgres://postgres:postgres@127.0.0.1:55432/fss_operations_test",
    "postgresql://postgres:postgres@localhost:5432/fss_growth_test",
    "postgres://postgres:postgres@[::1]:55432/fss_operations_test",
  ]) {
    assert.equal(requireOperationsTestDatabaseUrl(value), value);
  }
});
