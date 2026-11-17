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
