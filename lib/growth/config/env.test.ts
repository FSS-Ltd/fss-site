import assert from "node:assert/strict";
import test from "node:test";

import { parseGrowthServerEnv, requireGmailOAuthEnv, requireResendEnv } from "./env";

const tokenEncryptionKey = Buffer.alloc(32, 7).toString("base64");

const validEnv = {
  DATABASE_URL: "postgresql://app:secret@example.test:6543/postgres",
  DIRECT_DATABASE_URL: "postgresql://admin:secret@example.test:5432/postgres",
  AUTH_SECRET: "a".repeat(32),
  GOOGLE_AUTH_CLIENT_ID: "client-id",
  GOOGLE_AUTH_CLIENT_SECRET: "client-secret",
  GOOGLE_GMAIL_CLIENT_ID: "gmail-client-id",
  GOOGLE_GMAIL_CLIENT_SECRET: "gmail-client-secret",
  GOOGLE_GMAIL_REDIRECT_URI:
    "https://example.test/api/integrations/gmail/callback",
  GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
  TOKEN_ENCRYPTION_KEY: tokenEncryptionKey,
  GROWTH_OS_AGENT_HMAC_SECRET: "c".repeat(32),
  GROWTH_OS_AUTOMATIONS_ENABLED: "false",
};

test("accepts the complete server environment", () => {
  const result = parseGrowthServerEnv(validEnv);

  assert.equal(result.ownerEmail, "j.ntagengwa@faithfulsoftware.dev");
  assert.equal(result.googleGmailClientId, "gmail-client-id");
  assert.equal(result.googleGmailClientSecret, "gmail-client-secret");
  assert.equal(
    result.googleGmailRedirectUri,
    "https://example.test/api/integrations/gmail/callback",
  );
  assert.equal(result.tokenEncryptionKey, tokenEncryptionKey);
  assert.equal(result.agentHmacSecret, "c".repeat(32));
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

test("keeps non-agent Growth routes bootable before agent ingestion is configured", () => {
  const result = parseGrowthServerEnv({
    ...validEnv,
    GROWTH_OS_AGENT_HMAC_SECRET: undefined,
  });

  assert.equal(result.agentHmacSecret, undefined);
});

test("keeps non-Gmail Growth routes bootable before Gmail OAuth is configured", () => {
  const result = parseGrowthServerEnv({
    ...validEnv,
    GOOGLE_GMAIL_CLIENT_ID: undefined,
    GOOGLE_GMAIL_CLIENT_SECRET: undefined,
    GOOGLE_GMAIL_REDIRECT_URI: undefined,
    TOKEN_ENCRYPTION_KEY: "b".repeat(32),
  });

  assert.equal(result.googleGmailClientId, undefined);
  assert.throws(
    () => requireGmailOAuthEnv(result),
    /configuration is incomplete/i,
  );
});

test("rejects browser-visible credentials", () => {
  for (const name of [
    "NEXT_PUBLIC_DATABASE_URL",
    "NEXT_PUBLIC_DIRECT_DATABASE_URL",
    "NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY",
    "NEXT_PUBLIC_GOOGLE_GMAIL_CLIENT_ID",
    "NEXT_PUBLIC_GOOGLE_GMAIL_CLIENT_SECRET",
    "NEXT_PUBLIC_GOOGLE_GMAIL_REDIRECT_URI",
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

test("requires a complete dedicated Gmail OAuth client at its route boundary", () => {
  for (const name of [
    "GOOGLE_GMAIL_CLIENT_ID",
    "GOOGLE_GMAIL_CLIENT_SECRET",
    "GOOGLE_GMAIL_REDIRECT_URI",
  ]) {
    const environment = parseGrowthServerEnv({
      ...validEnv,
      [name]: undefined,
    });
    assert.throws(() => requireGmailOAuthEnv(environment), /incomplete/i);
  }

  assert.deepEqual(requireGmailOAuthEnv(parseGrowthServerEnv(validEnv)), {
    clientId: "gmail-client-id",
    clientSecret: "gmail-client-secret",
    redirectUri: "https://example.test/api/integrations/gmail/callback",
    tokenEncryptionKey,
  });
});

test("accepts only an exact HTTPS or loopback Gmail callback URI", () => {
  assert.equal(
    parseGrowthServerEnv({
      ...validEnv,
      GOOGLE_GMAIL_REDIRECT_URI:
        "http://localhost:3000/api/integrations/gmail/callback",
    }).googleGmailRedirectUri,
    "http://localhost:3000/api/integrations/gmail/callback",
  );

  for (const value of [
    "http://example.test/api/integrations/gmail/callback",
    "https://example.test/api/integrations/gmail/other",
    "https://example.test/api/integrations/gmail/callback?next=/growth",
    "https://user:password@example.test/api/integrations/gmail/callback",
  ]) {
    assert.throws(
      () =>
        parseGrowthServerEnv({
          ...validEnv,
          GOOGLE_GMAIL_REDIRECT_URI: value,
        }),
      /GOOGLE_GMAIL_REDIRECT_URI/,
    );
  }
});

test("requires exactly 32 bytes of canonical base64 token key material", () => {
  for (const value of [
    "b".repeat(32),
    Buffer.alloc(31, 7).toString("base64"),
    `${tokenEncryptionKey}=`,
  ]) {
    assert.throws(() => {
      const environment = parseGrowthServerEnv({
        ...validEnv,
        TOKEN_ENCRYPTION_KEY: value,
      });
      return requireGmailOAuthEnv(environment);
    }, /token encryption key is invalid/i);
  }
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

test("requires a complete Resend configuration at its route boundary", () => {
  const withoutResend = parseGrowthServerEnv(validEnv);
  assert.throws(() => requireResendEnv(withoutResend), /incomplete/i);

  const withResend = parseGrowthServerEnv({
    ...validEnv,
    RESEND_API_KEY: "resend-key",
    RESEND_FROM_EMAIL: "newsletter@faithfulsoftware.dev",
    RESEND_REPLY_TO_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
  });
  assert.deepEqual(requireResendEnv(withResend), {
    apiKey: "resend-key",
    from: "newsletter@faithfulsoftware.dev",
    replyTo: "j.ntagengwa@faithfulsoftware.dev",
  });
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

test("rejects production automations enabled without complete provider configuration", () => {
  assert.throws(
    () =>
      parseGrowthServerEnv({
        ...validEnv,
        VERCEL_ENV: "production",
        GROWTH_OS_AUTOMATIONS_ENABLED: "true",
        CRON_SECRET: "d".repeat(32),
        // Resend is left unconfigured.
      }),
    /GROWTH_OS_AUTOMATIONS_ENABLED.*provider configuration/i,
  );
});

test("accepts production automations enabled with complete provider configuration", () => {
  const result = parseGrowthServerEnv({
    ...validEnv,
    VERCEL_ENV: "production",
    GROWTH_OS_AUTOMATIONS_ENABLED: "true",
    CRON_SECRET: "d".repeat(32),
    RESEND_API_KEY: "resend-key",
    RESEND_FROM_EMAIL: "newsletter@faithfulsoftware.dev",
    RESEND_REPLY_TO_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
  });

  assert.equal(result.automationsEnabled, true);
});

test("allows preview and local environments to enable automations without full provider configuration", () => {
  const result = parseGrowthServerEnv({
    ...validEnv,
    VERCEL_ENV: "preview",
    GROWTH_OS_AUTOMATIONS_ENABLED: "true",
  });

  assert.equal(result.automationsEnabled, true);
});

test("rejects blank security credentials", () => {
  for (const name of [
    "AUTH_SECRET",
    "TOKEN_ENCRYPTION_KEY",
    "GROWTH_OS_AGENT_HMAC_SECRET",
  ]) {
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
