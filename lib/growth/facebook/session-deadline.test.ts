import assert from "node:assert/strict";
import test from "node:test";
import { encode } from "next-auth/jwt";
import { growthStreamDeadline } from "./session-deadline";

const secret = "a".repeat(32);
async function request(
  maxAge: number,
  signingSecret = secret,
): Promise<Request> {
  const token = await encode({
    secret: signingSecret,
    salt: "authjs.session-token",
    token: { email: "owner@example.test" },
    maxAge,
  });
  return new Request("http://localhost/api/growth/events", {
    headers: { cookie: `authjs.session-token=${token}` },
  });
}
test("deadline uses verified token expiry and rejects forged and expired tokens", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1_800_000_000_000 });
  const now = Date.now();
  const deadline = await growthStreamDeadline(await request(60), secret);
  assert.equal(deadline, now + 60000);
  assert.equal(
    await growthStreamDeadline(await request(60, "b".repeat(32)), secret),
    null,
  );
  assert.equal(await growthStreamDeadline(await request(-60), secret), null);
});
