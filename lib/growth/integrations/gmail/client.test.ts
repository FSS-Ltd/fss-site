import assert from "node:assert/strict";
import test from "node:test";

import {
  createGmailClient,
  GmailClientError,
  type GmailClientConfig,
} from "./client";

const config: GmailClientConfig = {
  clientId: "gmail-client-id",
  clientSecret: "gmail-client-secret",
  refreshToken: "gmail-refresh-token",
};
const profileResponse = {
  emailAddress: "j.ntagengwa@faithfulsoftware.dev",
  messagesTotal: 12,
  threadsTotal: 8,
  historyId: "987654321",
};

function tokenResponse(accessToken: string, expiresIn = 3600): Response {
  return Response.json({
    access_token: accessToken,
    expires_in: expiresIn,
    token_type: "Bearer",
  });
}

test("refreshes an access token and fetches a validated Gmail profile", async () => {
  const requests: Request[] = [];
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      requests.push(request);
      return requests.length === 1
        ? tokenResponse("access-token")
        : Response.json(profileResponse);
    },
    nowEpochSeconds: () => 1_000,
  });

  const profile = await client.getProfile();

  assert.deepEqual(profile, {
    emailAddress: profileResponse.emailAddress,
    historyId: profileResponse.historyId,
  });
  assert.equal(requests[0]?.url, "https://oauth2.googleapis.com/token");
  assert.equal(requests[0]?.method, "POST");
  assert.equal(
    requests[0]?.headers.get("content-type"),
    "application/x-www-form-urlencoded;charset=UTF-8",
  );
  assert.deepEqual(
    Object.fromEntries(new URLSearchParams(await requests[0]?.text())),
    {
      client_id: config.clientId,
      client_secret: config.clientSecret,
      grant_type: "refresh_token",
      refresh_token: config.refreshToken,
    },
  );
  assert.equal(
    requests[1]?.url,
    "https://gmail.googleapis.com/gmail/v1/users/me/profile",
  );
  assert.equal(requests[1]?.method, "GET");
  assert.equal(
    requests[1]?.headers.get("authorization"),
    "Bearer access-token",
  );
  assert.equal(requests[1]?.headers.get("accept"), "application/json");
  assert.equal(requests[1]?.headers.has("client-secret"), false);
  assert.equal(
    requests.every((request) => request.signal !== undefined),
    true,
  );
});

test("reuses a live access token and refreshes it before expiry", async () => {
  let now = 1_000;
  const authorizations: Array<string | null> = [];
  let refreshes = 0;
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (request.url.endsWith("/token")) {
        refreshes += 1;
        return tokenResponse(`access-${refreshes}`, 120);
      }
      authorizations.push(request.headers.get("authorization"));
      return Response.json(profileResponse);
    },
    nowEpochSeconds: () => now,
  });

  await client.getProfile();
  now = 1_050;
  await client.getProfile();
  now = 1_061;
  await client.getProfile();

  assert.equal(refreshes, 2);
  assert.deepEqual(authorizations, [
    "Bearer access-1",
    "Bearer access-1",
    "Bearer access-2",
  ]);
});

test("shares one access-token refresh across concurrent Gmail requests", async () => {
  let refreshes = 0;
  const client = createGmailClient(config, {
    fetch: async (input) => {
      if (String(input).endsWith("/token")) {
        refreshes += 1;
        await Promise.resolve();
        return tokenResponse("shared-access-token");
      }
      return Response.json(profileResponse);
    },
  });

  await Promise.all([client.getProfile(), client.getProfile()]);

  assert.equal(refreshes, 1);
});

test("anchors access-token expiry when the token response arrives", async () => {
  let now = 1_000;
  let refreshes = 0;
  const client = createGmailClient(config, {
    fetch: async (input) => {
      if (String(input).endsWith("/token")) {
        refreshes += 1;
        const body = JSON.stringify({
          access_token: `access-${refreshes}`,
          expires_in: 120,
          token_type: "Bearer",
        });
        return new Response(
          new ReadableStream({
            start(controller) {
              setTimeout(() => {
                now = 1_061;
                controller.enqueue(new TextEncoder().encode(body));
                controller.close();
              }, 0);
            },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      return Response.json(profileResponse);
    },
    nowEpochSeconds: () => now,
  });

  await client.getProfile();
  await client.getProfile();

  assert.equal(refreshes, 2);
});

test("refreshes once after a 401 and retries with the replacement token", async () => {
  const authorizations: Array<string | null> = [];
  let refreshes = 0;
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (request.url.endsWith("/token")) {
        refreshes += 1;
        return tokenResponse(`access-${refreshes}`);
      }
      authorizations.push(request.headers.get("authorization"));
      return authorizations.length === 1
        ? new Response(null, { status: 401 })
        : Response.json(profileResponse);
    },
  });

  assert.deepEqual(await client.getProfile(), {
    emailAddress: profileResponse.emailAddress,
    historyId: profileResponse.historyId,
  });
  assert.equal(refreshes, 2);
  assert.deepEqual(authorizations, ["Bearer access-1", "Bearer access-2"]);
});

test("does not retry repeatedly when replacement credentials are rejected", async () => {
  let profileRequests = 0;
  const client = createGmailClient(config, {
    fetch: async (input) => {
      if (String(input).endsWith("/token"))
        return tokenResponse("access-token");
      profileRequests += 1;
      return new Response(null, { status: 401 });
    },
  });

  await assert.rejects(
    client.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "AUTHENTICATION_FAILED" &&
      error.retryable === false,
  );
  assert.equal(profileRequests, 2);
});

test("does not let a late stale 401 evict a newer access token", async () => {
  let refreshes = 0;
  let profileRequests = 0;
  let releaseLateRequest: (() => void) | undefined;
  const lateRequest = new Promise<void>((resolve) => {
    releaseLateRequest = resolve;
  });
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (request.url.endsWith("/token")) {
        refreshes += 1;
        return tokenResponse(`access-${refreshes}`);
      }

      profileRequests += 1;
      if (profileRequests === 1) return Response.json(profileResponse);
      if (profileRequests === 2) return new Response(null, { status: 401 });
      if (profileRequests === 3) {
        await lateRequest;
        return new Response(null, { status: 401 });
      }
      if (profileRequests === 4) releaseLateRequest?.();
      return Response.json(profileResponse);
    },
  });

  await client.getProfile();
  await Promise.all([client.getProfile(), client.getProfile()]);

  assert.equal(refreshes, 2);
  assert.equal(profileRequests, 5);
});

test("classifies throttling, server failures, and network failures as retryable", async () => {
  for (const failure of [
    () => new Response(null, { status: 429 }),
    () => new Response(null, { status: 503 }),
    () => {
      throw new Error("provider network detail");
    },
  ]) {
    const client = createGmailClient(config, {
      fetch: async (input) =>
        String(input).endsWith("/token")
          ? tokenResponse("access-token")
          : failure(),
    });

    await assert.rejects(
      client.getProfile(),
      (error: unknown) =>
        error instanceof GmailClientError &&
        error.code === "RETRYABLE_PROVIDER_ERROR" &&
        error.retryable === true &&
        !error.message.includes("provider network detail"),
    );
  }
});

test("classifies a non-authentication 4xx response as permanent", async () => {
  const client = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse("access-token")
        : Response.json(
            { error: { message: "provider-private-detail" } },
            { status: 400 },
          ),
  });

  await assert.rejects(
    client.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "PERMANENT_PROVIDER_ERROR" &&
      error.retryable === false &&
      !error.message.includes("provider-private-detail"),
  );
});

test("classifies Gmail 403 rate-limit reasons as retryable", async () => {
  for (const reason of ["rateLimitExceeded", "userRateLimitExceeded"]) {
    const client = createGmailClient(config, {
      fetch: async (input) =>
        String(input).endsWith("/token")
          ? tokenResponse("access-token")
          : Response.json(
              {
                error: {
                  errors: [{ reason, message: "private provider detail" }],
                  message: "private provider detail",
                },
              },
              { status: 403 },
            ),
    });

    await assert.rejects(
      client.getProfile(),
      (error: unknown) =>
        error instanceof GmailClientError &&
        error.code === "RETRYABLE_PROVIDER_ERROR" &&
        error.retryable === true &&
        !error.message.includes("private provider detail"),
    );
  }
});

test("classifies refresh-token rejection and throttling safely", async () => {
  const rejectedClient = createGmailClient(config, {
    fetch: async () =>
      Response.json(
        { error: "invalid_grant", error_description: "private detail" },
        { status: 400 },
      ),
  });
  await assert.rejects(
    rejectedClient.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "AUTHENTICATION_FAILED" &&
      error.retryable === false &&
      !error.message.includes("private detail"),
  );

  const throttledClient = createGmailClient(config, {
    fetch: async () => new Response(null, { status: 429 }),
  });
  await assert.rejects(
    throttledClient.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "RETRYABLE_PROVIDER_ERROR" &&
      error.retryable === true,
  );
});

test("rejects invalid refresh and Gmail response schemas without leaking data", async () => {
  const invalidTokenClient = createGmailClient(config, {
    fetch: async () =>
      Response.json({
        access_token: "secret-access-token",
        expires_in: "3600",
        token_type: "Bearer",
      }),
  });
  await assert.rejects(
    invalidTokenClient.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE" &&
      !error.message.includes("secret-access-token"),
  );

  const invalidProfileClient = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse("access-token")
        : Response.json({
            emailAddress: "not-an-email",
            historyId: "private-provider-data",
          }),
  });
  await assert.rejects(
    invalidProfileClient.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE" &&
      !error.message.includes("private-provider-data"),
  );
});

test("distinguishes transient body reads from completed malformed JSON", async () => {
  const bodyFailureClient = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse("access-token")
        : new Response(
            new ReadableStream({
              start(controller) {
                controller.error(
                  new DOMException("stream detail", "AbortError"),
                );
              },
            }),
          ),
  });
  await assert.rejects(
    bodyFailureClient.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "RETRYABLE_PROVIDER_ERROR" &&
      error.retryable === true &&
      !error.message.includes("stream detail"),
  );

  const malformedClient = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse("access-token")
        : new Response("{not-json", {
            headers: { "Content-Type": "application/json" },
          }),
  });
  await assert.rejects(
    malformedClient.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE" &&
      error.retryable === false,
  );
});

test("rejects an oversized JSON response before reading its stream", async () => {
  const client = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse("access-token")
        : new Response(
            new ReadableStream({
              pull(controller) {
                controller.enqueue(new Uint8Array([123]));
              },
            }),
            { headers: { "Content-Length": String(256 * 1024 + 1) } },
          ),
  });

  await assert.rejects(
    client.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE" &&
      error.retryable === false,
  );
});

test("cancels a chunked JSON response when the streaming ceiling is exceeded", async () => {
  let cancelled = false;
  const client = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse("access-token")
        : new Response(
            new ReadableStream({
              pull(controller) {
                controller.enqueue(new Uint8Array(140 * 1024));
              },
              cancel() {
                cancelled = true;
              },
            }),
          ),
  });

  await assert.rejects(
    client.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE" &&
      error.retryable === false,
  );
  assert.equal(cancelled, true);
});

test("rejects malformed UTF-8 after a complete bounded response", async () => {
  const client = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse("access-token")
        : new Response(new Uint8Array([0xc3, 0x28])),
  });

  await assert.rejects(
    client.getProfile(),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE" &&
      error.retryable === false,
  );
});

test("rejects blank credentials before making a request", async () => {
  let requested = false;
  const client = createGmailClient(
    { ...config, refreshToken: " " },
    {
      fetch: async () => {
        requested = true;
        return tokenResponse("access-token");
      },
    },
  );

  await assert.rejects(client.getProfile(), /refresh token/i);
  assert.equal(requested, false);
});
