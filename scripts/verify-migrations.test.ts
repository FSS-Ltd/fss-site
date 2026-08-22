import assert from "node:assert/strict";
import test from "node:test";

import { checkMigrationPolicy, type MigrationFile } from "./verify-migrations";

function file(filename: string, content: string): MigrationFile {
  return { filename, content };
}

const VALID_MIGRATION = file(
  "20260101000000_growth_example.sql",
  `
    create table growth.widgets (
      id uuid primary key default gen_random_uuid()
    );
    revoke all on growth.widgets from anon, authenticated;
    grant select on growth.widgets to growth_app;
  `,
);

test("accepts a well-formed migration file with no violations", () => {
  const violations = checkMigrationPolicy([VALID_MIGRATION]);
  assert.deepEqual(violations, []);
});

test("flags duplicate migration timestamps", () => {
  const violations = checkMigrationPolicy([
    file("20260101000000_growth_first.sql", "select 1;"),
    file("20260101000000_growth_second.sql", "select 1;"),
  ]);

  assert.equal(
    violations.filter((v) => v.rule === "duplicate_timestamp").length,
    2,
  );
});

test("flags a non-SQL file in the migrations directory", () => {
  const violations = checkMigrationPolicy([
    file("20260101000000_notes.txt", "not sql"),
  ]);

  assert.deepEqual(
    violations.map((v) => v.rule),
    ["non_sql_file"],
  );
});

test("flags a destructive drop table statement", () => {
  const violations = checkMigrationPolicy([
    file("20260101000000_growth_drop.sql", "drop table growth.widgets;"),
  ]);

  assert.ok(violations.some((v) => v.rule === "destructive_statement"));
});

test("flags a destructive truncate statement", () => {
  const violations = checkMigrationPolicy([
    file("20260101000000_growth_truncate.sql", "truncate growth.widgets;"),
  ]);

  assert.ok(violations.some((v) => v.rule === "destructive_statement"));
});

test("flags a table created without private schema qualification", () => {
  const violations = checkMigrationPolicy([
    file("20260101000000_growth_unqualified.sql", "create table widgets (id uuid);"),
  ]);

  assert.ok(
    violations.some((v) => v.rule === "missing_schema_qualification"),
  );
});

test("flags a grant of Growth OS access to a browser-facing role", () => {
  const violations = checkMigrationPolicy([
    file(
      "20260101000000_growth_leaky_grant.sql",
      "grant select on growth.widgets to anon;",
    ),
  ]);

  assert.ok(violations.some((v) => v.rule === "browser_role_grant"));
});

test("does not flag a revoke statement naming a browser-facing role", () => {
  const violations = checkMigrationPolicy([
    file(
      "20260101000000_growth_revoke.sql",
      "revoke all on growth.widgets from anon, authenticated;",
    ),
  ]);

  assert.deepEqual(violations, []);
});

test("reports every violation with the offending filename", () => {
  const violations = checkMigrationPolicy([
    file("20260101000000_growth_bad.sql", "drop table growth.widgets;"),
  ]);

  assert.equal(violations[0]?.filename, "20260101000000_growth_bad.sql");
});
