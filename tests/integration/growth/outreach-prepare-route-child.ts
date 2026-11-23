import assert from "node:assert/strict";

async function main(): Promise<void> {
  let sendPosts = 0;
  let profileRequests = 0;
  const mode = process.env.PREP_TEST_MODE;
  if (mode !== "complete" && mode !== "held")
    throw new Error("invalid fixture mode");
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (
    database.hostname !== "127.0.0.1" ||
    !["55488", "55489"].includes(database.port) ||
    database.pathname !== "/fss_growth_test" ||
    database.searchParams.get("options") !== "-c role=growth_app"
  )
    throw new Error("invalid fixture database");
  globalThis.fetch = async (resource, init) => {
    const url = new URL(String(resource));
    if (url.href === "https://oauth2.googleapis.com/token")
      return Response.json({
        access_token: "synthetic-access",
        expires_in: 3600,
        token_type: "Bearer",
      });
    if (url.origin !== "https://gmail.googleapis.com")
      throw new Error("unexpected network");
    if (url.pathname.endsWith("/messages/send") || init?.method === "POST") {
      sendPosts++;
      throw new Error("unexpected provider write");
    }
    if (url.pathname.endsWith("/profile")) {
      profileRequests++;
      return Response.json({
        emailAddress: "j.ntagengwa@faithfulsoftware.dev",
        historyId: "200",
      });
    }
    if (url.pathname.endsWith("/history"))
      return Response.json({
        historyId: mode === "held" && profileRequests >= 2 ? "invalid" : "200",
        history: [],
      });
    if (url.pathname.endsWith("/messages"))
      return Response.json({ messages: [] });
    throw new Error("unexpected Gmail path");
  };
  const { GET } = await import("../../../app/api/cron/outreach-prepare/route");
  const request = new Request(
    "https://example.test/api/cron/outreach-prepare",
    {
      headers: { authorization: `Bearer ${"c".repeat(32)}` },
    },
  );
  const NativeDate = globalThis.Date;
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, args, newTarget) {
      if (args.length === 0) {
        globalThis.Date = NativeDate;
        return new NativeDate("2026-01-05T08:30:00Z");
      }
      return Reflect.construct(target, args, newTarget);
    },
  });
  let response: Response;
  try {
    response = await GET(request);
  } finally {
    globalThis.Date = NativeDate;
  }
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.ok, true);
  assert.equal(body.usage, mode);
  assert.equal(body.first.claimed, 0);
  assert.equal(body.followUp.claimed, 0);
  assert.equal(sendPosts, 0);
  assert.ok(profileRequests > 0);
  process.env.GROWTH_OS_RESEND_OUTREACH_ENABLED = "true";
  globalThis.Date = new Proxy(NativeDate, {
    construct(target, args, newTarget) {
      if (args.length === 0) {
        globalThis.Date = NativeDate;
        return new NativeDate("2026-01-05T08:30:00Z");
      }
      return Reflect.construct(target, args, newTarget);
    },
  });
  try {
    const enabled = await GET(
      new Request("https://example.test/api/cron/outreach-prepare", {
        headers: { authorization: `Bearer ${"c".repeat(32)}` },
      }),
    );
    const result = await enabled.json();
    assert.equal(enabled.status, 200);
    assert.equal(result.preparation.usage, mode);
    assert.deepEqual(
      { status: result.resend.status, reason: result.resend.reason },
      { status: "held", reason: "account_binding_unknown" },
    );
    assert.equal(sendPosts, 0);
  } finally {
    globalThis.Date = NativeDate;
  }
  const { getGrowthDb } = await import("../../../lib/growth/db/client");
  await getGrowthDb().end();
}
void main();
