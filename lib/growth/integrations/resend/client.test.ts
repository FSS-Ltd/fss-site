import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { createResendClient, ResendClientError, type ResendMessage } from "./client";

type CapturedRequest = {
  method: string | undefined;
  headers: http.IncomingHttpHeaders;
  body: Record<string, unknown>;
};

type TestServer = {
  url: string;
  requests: CapturedRequest[];
  close: () => Promise<void>;
};

async function startServer(
  handler: (request: CapturedRequest, response: http.ServerResponse, requestIndex: number) => void,
): Promise<TestServer> {
  const requests: CapturedRequest[] = [];
  const server = http.createServer((req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => chunks.push(chunk));
    req.on("end", () => {
      const rawBody = Buffer.concat(chunks).toString("utf8");
      const captured: CapturedRequest = {
        method: req.method,
        headers: req.headers,
        body: rawBody ? JSON.parse(rawBody) : {},
      };
      requests.push(captured);
      handler(captured, res, requests.length - 1);
    });
  });

  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;

  return {
    url: `http://127.0.0.1:${port}`,
    requests,
    close: () =>
      new Promise((resolve) => {
        server.close(() => resolve());
        // The client's own timeout abandons a hung request without cancelling
        // the underlying socket (the Resend SDK exposes no fetch/AbortSignal
        // injection), so a never-answered connection would otherwise keep
        // `close()` waiting forever.
        server.closeAllConnections();
      }),
  };
}

function jsonResponse(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function validationErrorBody(message: string) {
  return { message, statusCode: 400, name: "validation_error" };
}

function baseMessage(overrides: Partial<ResendMessage> = {}): ResendMessage {
  return {
    idempotencyKey: "message-1234",
    category: "site-enquiry",
    from: "FSS <hello@faithfulsoftwaresolutions.co.uk>",
    to: "ada@example.test",
    replyTo: "j.ntagengwa@faithfulsoftware.dev",
    subject: "We received your request",
    html: "<p>Hi Ada,</p>",
    text: "Hi Ada,",
    ...overrides,
  };
}

const NO_DELAY = { retryDelayMs: () => 0, sleep: async () => undefined };

test("sends successfully and returns the provider message id", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 200, { id: "email-abc123" });
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    const result = await client.send(baseMessage());
    assert.deepEqual(result, { providerMessageId: "email-abc123" });
    assert.equal(server.requests.length, 1);
  } finally {
    await server.close();
  }
});

test("retries a 429 response and succeeds on the next attempt", async () => {
  const server = await startServer((_request, res, index) => {
    if (index === 0) {
      jsonResponse(res, 429, { message: "Too many requests", statusCode: 429, name: "rate_limit_exceeded" });
      return;
    }
    jsonResponse(res, 200, { id: "email-after-retry" });
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    const result = await client.send(baseMessage());
    assert.deepEqual(result, { providerMessageId: "email-after-retry" });
    assert.equal(server.requests.length, 2);
  } finally {
    await server.close();
  }
});

test("retries a 5xx response and succeeds on the next attempt", async () => {
  const server = await startServer((_request, res, index) => {
    if (index === 0) {
      jsonResponse(res, 503, { message: "Service unavailable", statusCode: 503, name: "internal_server_error" });
      return;
    }
    jsonResponse(res, 200, { id: "email-after-503" });
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    const result = await client.send(baseMessage());
    assert.deepEqual(result, { providerMessageId: "email-after-503" });
    assert.equal(server.requests.length, 2);
  } finally {
    await server.close();
  }
});

test("treats a request that never responds as retryable and succeeds on the next attempt", async () => {
  const server = await startServer((_request, res, index) => {
    if (index === 0) {
      // Never respond, forcing the client's own timeout to fire.
      return;
    }
    jsonResponse(res, 200, { id: "email-after-timeout" });
  });
  try {
    const client = createResendClient("test-key", {
      baseUrl: server.url,
      requestTimeoutMs: 50,
      ...NO_DELAY,
    });
    const result = await client.send(baseMessage());
    assert.deepEqual(result, { providerMessageId: "email-after-timeout" });
  } finally {
    await server.close();
  }
});

test("does not retry a permanent validation failure", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 400, validationErrorBody("Invalid `from` field."));
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    await assert.rejects(client.send(baseMessage()), (error: unknown) => {
      assert.ok(error instanceof ResendClientError);
      assert.equal(error.code, "PERMANENT_PROVIDER_ERROR");
      assert.equal(error.retryable, false);
      return true;
    });
    assert.equal(server.requests.length, 1);
  } finally {
    await server.close();
  }
});

test("gives up after the maximum attempts and throws the last retryable error", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 503, { message: "Service unavailable", statusCode: 503, name: "internal_server_error" });
  });
  try {
    const client = createResendClient("test-key", {
      baseUrl: server.url,
      maxAttempts: 2,
      ...NO_DELAY,
    });
    await assert.rejects(client.send(baseMessage()), (error: unknown) => {
      assert.ok(error instanceof ResendClientError);
      assert.equal(error.code, "RETRYABLE_PROVIDER_ERROR");
      return true;
    });
    assert.equal(server.requests.length, 2);
  } finally {
    await server.close();
  }
});

test("sends the idempotency key as a request header", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 200, { id: "email-idempotent" });
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    await client.send(baseMessage({ idempotencyKey: "unique-message-key-42" }));
    assert.equal(server.requests[0].headers["idempotency-key"], "unique-message-key-42");
  } finally {
    await server.close();
  }
});

test("sends the reply-to address", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 200, { id: "email-reply-to" });
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    await client.send(baseMessage({ replyTo: "j.ntagengwa@faithfulsoftware.dev" }));
    assert.equal(server.requests[0].body.reply_to, "j.ntagengwa@faithfulsoftware.dev");
  } finally {
    await server.close();
  }
});

test("forwards list-unsubscribe headers", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 200, { id: "email-list-unsubscribe" });
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    await client.send(
      baseMessage({
        category: "newsletter",
        headers: {
          "List-Unsubscribe": "<https://faithfulsoftwaresolutions.co.uk/newsletter/unsubscribe?token=abc>",
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      }),
    );
    assert.deepEqual(server.requests[0].body.headers, {
      "List-Unsubscribe": "<https://faithfulsoftwaresolutions.co.uk/newsletter/unsubscribe?token=abc>",
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    });
  } finally {
    await server.close();
  }
});

test("rejects a cold-outreach category before making any request", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 200, { id: "should-not-be-called" });
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    await assert.rejects(
      client.send(baseMessage({ category: "cold-outreach" as ResendMessage["category"] })),
      (error: unknown) => {
        assert.ok(error instanceof ResendClientError);
        assert.equal(error.code, "REJECTED_CATEGORY");
        return true;
      },
    );
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("rejects a blank required field before making any request", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 200, { id: "should-not-be-called" });
  });
  try {
    const client = createResendClient("test-key", { baseUrl: server.url, ...NO_DELAY });
    await assert.rejects(client.send(baseMessage({ subject: "   " })), TypeError);
    assert.equal(server.requests.length, 0);
  } finally {
    await server.close();
  }
});

test("reports a redacted provider-error event with no recipient or content fields", async () => {
  const server = await startServer((_request, res) => {
    jsonResponse(res, 503, { message: "Service unavailable", statusCode: 503, name: "internal_server_error" });
  });
  try {
    const events: Record<string, unknown>[] = [];
    const client = createResendClient("test-key", {
      baseUrl: server.url,
      maxAttempts: 1,
      ...NO_DELAY,
      onProviderError: (event) => events.push(event),
    });
    await assert.rejects(client.send(baseMessage()));

    assert.equal(events.length, 1);
    assert.deepEqual(Object.keys(events[0]).sort(), [
      "attempt",
      "category",
      "code",
      "idempotencyKey",
      "retryable",
    ]);
    const serialised = JSON.stringify(events[0]);
    assert.doesNotMatch(serialised, /ada@example\.test/);
    assert.doesNotMatch(serialised, /Hi Ada/);
    assert.doesNotMatch(serialised, /We received your request/);
  } finally {
    await server.close();
  }
});
