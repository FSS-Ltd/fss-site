import assert from "node:assert/strict";
import test from "node:test";
import { validateFacebookEventUrl } from "./events";
test("event URL refuses transaction pooling and privileged roles", () => {
  assert.throws(() =>
    validateFacebookEventUrl("postgresql://postgres@localhost:5432/db"),
  );
  assert.throws(() =>
    validateFacebookEventUrl("postgresql://growth_app@localhost:6543/db"),
  );
  assert.throws(() =>
    validateFacebookEventUrl(
      "postgresql://growth_app@localhost:5432/db?pgbouncer=true",
    ),
  );
  assert.doesNotThrow(() =>
    validateFacebookEventUrl("postgresql://growth_app@localhost:5432/db"),
  );
});

test("event capability is optional and cannot use a public variable", async () => {
  const { readFacebookEventUrl } = await import("./events");
  assert.equal(readFacebookEventUrl({}), undefined);
  assert.throws(() =>
    readFacebookEventUrl({ NEXT_PUBLIC_GROWTH_EVENT_DATABASE_URL: "anything" }),
  );
});

test("recognizes only Supabase session pooler and matching Growth role form", () => {
  const host = "aws-0-eu-west-1.pooler.supabase.com";
  const user = "growth_app.abcdefghijklmnopqrst";
  assert.doesNotThrow(() =>
    validateFacebookEventUrl(
      `postgresql://${user}:secret@${host}:5432/postgres`,
    ),
  );
  assert.throws(() =>
    validateFacebookEventUrl(
      `postgresql://${user}:secret@${host}:6543/postgres`,
    ),
  );
  assert.throws(() =>
    validateFacebookEventUrl(
      `postgresql://${user}:secret@${host}:5432/postgres?pool_mode=transaction`,
    ),
  );
  assert.throws(() =>
    validateFacebookEventUrl(
      `postgresql://postgres.abcdefghijklmnopqrst:secret@${host}:5432/postgres`,
    ),
  );
  assert.throws(() =>
    validateFacebookEventUrl(
      `postgresql://${user}:secret@pooler.example.com:5432/postgres`,
    ),
  );
  assert.throws(() =>
    validateFacebookEventUrl(
      `postgresql://${user}:secret@db.example.com:5432/postgres`,
    ),
  );
});
