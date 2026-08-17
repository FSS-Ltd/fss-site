import assert from "node:assert/strict";
import test from "node:test";

import { parseGrowthServerEnv } from "./env";

const validEnv = {
  DATABASE_URL: "postgresql://app:secret@example.test:6543/postgres",
  DIRECT_DATABASE_URL: "postgresql://admin:secret@example.test:5432/postgres",
  AUTH_SECRET: "a".repeat(32),
  GOOGLE_AUTH_CLIENT_ID: "client-id",
  GOOGLE_AUTH_CLIENT_SECRET: "client-secret",
  GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
  TOKEN_ENCRYPTION_KEY: "b".repeat(32),
  GROWTH_OS_AUTOMATIONS_ENABLED: "false",
};

test("accepts the complete server environment", () => {
  const result = parseGrowthServerEnv(validEnv);

  assert.equal(result.ownerEmail, "j.ntagengwa@faithfulsoftware.dev");
  assert.equal(result.automationsEnabled, false);
});

test("normalises the founder address and enabled flag", () => {
  const result = parseGrowthServerEnv({
    ...validEnv,
    GROWTH_OS_OWNER_EMAIL: "  J.NTAGENGWA@FAITHFULSOFTWARE.DEV  ",
    GROWTH_OS_AUTOMATIONS_ENABLED: "true",
  });

  assert.equal(result.ownerEmail, "j.ntagengwa@faithfulsoftware.dev");
  assert.equal(result.automationsEnabled, true);
});

test("rejects browser-visible credentials", () => {
  for (const name of [
    "NEXT_PUBLIC_DATABASE_URL",
    "NEXT_PUBLIC_DIRECT_DATABASE_URL",
    "NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY",
  ]) {
    assert.throws(
      () =>
        parseGrowthServerEnv({
          ...validEnv,
          [name]: "exposed-secret",
        }),
      new RegExp(name),
    );
  }
});

test("rejects the wrong founder address", () => {
  assert.throws(
    () =>
      parseGrowthServerEnv({
        ...validEnv,
        GROWTH_OS_OWNER_EMAIL: "someone@example.com",
      }),
    /GROWTH_OS_OWNER_EMAIL/,
  );
});

test("rejects incomplete credentials", () => {
  assert.throws(
    () =>
      parseGrowthServerEnv({
        ...validEnv,
        AUTH_SECRET: "short",
      }),
    /AUTH_SECRET/,
  );
});

test("rejects invalid automation values", () => {
  assert.throws(
    () =>
      parseGrowthServerEnv({
        ...validEnv,
        GROWTH_OS_AUTOMATIONS_ENABLED: "yes",
      }),
    /GROWTH_OS_AUTOMATIONS_ENABLED/,
  );
});

test("rejects non-PostgreSQL database URLs", () => {
  for (const name of ["DATABASE_URL", "DIRECT_DATABASE_URL"]) {
    assert.throws(
      () =>
        parseGrowthServerEnv({
          ...validEnv,
          [name]: "https://example.test/database",
        }),
      new RegExp(name),
    );
  }
});

test("rejects blank security credentials", () => {
  for (const name of ["AUTH_SECRET", "TOKEN_ENCRYPTION_KEY"]) {
    assert.throws(
      () =>
        parseGrowthServerEnv({
          ...validEnv,
          [name]: " ".repeat(32),
        }),
      new RegExp(name),
    );
  }
});
