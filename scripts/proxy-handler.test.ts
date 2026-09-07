import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";
import { NextFetchEvent } from "next/dist/server/web/spec-extension/fetch-event";
import { encode } from "next-auth/jwt";
import { proxy } from "../proxy";

function invoke(path: string, cookie?: string) {
  const request = new NextRequest(`https://fss.test${path}`, {
    headers: { host: "fss.test", ...(cookie ? { cookie } : {}) },
  });
  const event = new NextFetchEvent({
    request,
    page: "/proxy",
    context: undefined,
  });
  return proxy(request, event);
}

test("exported combined proxy preserves actual lazy Auth.js Growth redirects and login", async () => {
  const env = {
    DATABASE_URL: "postgres://synthetic:synthetic@localhost/synthetic",
    AUTH_SECRET: "a".repeat(32),
    AUTH_TRUST_HOST: "true",
    GOOGLE_AUTH_CLIENT_ID: "synthetic-google-id",
    GOOGLE_AUTH_CLIENT_SECRET: "synthetic-google-secret",
    GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
    TOKEN_ENCRYPTION_KEY: "b".repeat(32),
    GROWTH_OS_AUTOMATIONS_ENABLED: "false",
    OPERATIONS_ENABLED: "false",
  };
  const previous = new Map(
    [...Object.keys(env), "DIRECT_DATABASE_URL"].map((key) => [
      key,
      process.env[key],
    ]),
  );
  Object.assign(process.env, env);
  delete process.env.DIRECT_DATABASE_URL;
  try {
    const response = await invoke("/growth/prospects?status=new");
    assert.ok(response instanceof Response);
    assert.equal(response.status, 307);
    assert.equal(
      response.headers.get("location"),
      "https://fss.test/growth/login",
    );
    assert.match(
      response.headers.get("set-cookie") ?? "",
      /growth\.callback_path=%2Fgrowth%2Fprospects%3Fstatus%3Dnew/,
    );
    const login = await invoke("/growth/login");
    assert.ok(login instanceof Response);
    assert.equal(login.status, 200);
    assert.equal(login.headers.get("x-middleware-next"), "1");
    const salt = "__Secure-authjs.session-token";
    const token = await encode({
      secret: env.AUTH_SECRET,
      salt,
      token: { email: env.GROWTH_OS_OWNER_EMAIL, founderEmailVerified: true },
    });
    const authorised = await invoke("/growth/prospects", `${salt}=${token}`);
    assert.ok(authorised instanceof Response);
    assert.equal(authorised.status, 200);
    assert.equal(authorised.headers.get("x-middleware-next"), "1");
    const portal = await invoke("/portal/login");
    assert.ok(portal instanceof Response);
    assert.equal(portal.headers.get("cache-control"), "private, no-store");
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
