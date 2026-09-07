import assert from "node:assert/strict";
import test from "node:test";
import {
  createPortalLoginHandler,
  type PortalLoginDependencies,
} from "./login-handler";
const origin = "https://portal.example.test";
function fixture(overrides: Partial<PortalLoginDependencies> = {}) {
  const emails: string[] = [];
  const cookies: (string | null)[] = [];
  const reports: unknown[] = [];
  return {
    emails,
    cookies,
    reports,
    handler: createPortalLoginHandler({
      enabled: true,
      configured: true,
      origin,
      createCorrelationId: () => "synthetic-correlation",
      reportUnexpectedError: (report) => reports.push(report),
      consumeRateLimit: async () => true,
      startLogin: async (email) => {
        emails.push(email);
      },
      setPendingInvite: async (token) => {
        cookies.push(token);
      },
      ...overrides,
    }),
  };
}
function request(
  body: unknown = { email: "Client@example.test" },
  headers: Record<string, string> = {},
) {
  return new Request(`${origin}/portal/auth/start`, {
    method: "POST",
    headers: { origin, "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("login validates origin, strict payload and body size before sending", async () => {
  const f = fixture();
  for (const [req, status] of [
    [request(undefined, { origin: "https://evil.test" }), 403],
    [request({ email: "bad" }), 422],
    [
      request({
        email: "client@example.test",
        userId: "forged",
        role: "owner",
      }),
      422,
    ],
    [request({ email: "client@example.test", inviteToken: "bad" }), 422],
    [request(undefined, { "content-length": "9000" }), 413],
    [request(undefined, { "content-type": "text/plain" }), 415],
  ] as const)
    assert.equal((await f.handler(req)).status, status);
  assert.deepEqual(f.emails, []);
});
test("login consumes rate limit and conceals account existence with private responses", async () => {
  const blocked = fixture({ consumeRateLimit: async () => false });
  assert.equal((await blocked.handler(request())).status, 429);
  assert.deepEqual(blocked.emails, []);
  const f = fixture();
  const token = "a".repeat(43);
  const success = await f.handler(
    request({ email: "Client@example.test", inviteToken: token }),
  );
  assert.equal(success.status, 200);
  assert.deepEqual(f.emails, ["client@example.test"]);
  assert.deepEqual(f.cookies, [token]);
  assert.equal(success.headers.get("cache-control"), "private, no-store");
  assert.equal(success.headers.get("referrer-policy"), "no-referrer");
  const failure = fixture({
    startLogin: async () => {
      throw new Error("sensitive-provider-details");
    },
  });
  const hidden = await failure.handler(request());
  assert.equal(hidden.status, 200);
  assert.equal(await hidden.text(), await success.text());
  assert.deepEqual(failure.cookies, [null]);
  assert.doesNotMatch(
    JSON.stringify(failure.reports),
    /sensitive-provider-details/,
  );
});
test("login feature and configuration gates fail closed", async () => {
  assert.equal(
    (await fixture({ enabled: false }).handler(request())).status,
    404,
  );
  assert.equal(
    (await fixture({ configured: false }).handler(request())).status,
    503,
  );
});

test("login clears old invitation on ordinary sign-in and rejects unreadable JSON", async () => {
  const f = fixture();
  await f.handler(request());
  assert.deepEqual(f.cookies, [null]);
  const invalid = new Request(`${origin}/portal/auth/start`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: "{",
  });
  assert.equal((await f.handler(invalid)).status, 422);
  const oversized = request({ email: "a".repeat(9000) });
  assert.equal((await f.handler(oversized)).status, 413);
  const unavailable = fixture({
    consumeRateLimit: async () => {
      throw new Error("Database unavailable");
    },
  });
  assert.equal((await unavailable.handler(request())).status, 503);
});
