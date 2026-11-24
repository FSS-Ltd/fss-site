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

function tokenResponse(): Response {
  return Response.json({
    access_token: "access-token",
    expires_in: 3600,
    token_type: "Bearer",
  });
}

function metadataResponse(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: "message-id",
    threadId: "thread-id",
    labelIds: ["INBOX"],
    historyId: "301",
    internalDate: "1786972800000",
    snippet: "private body preview",
    raw: "cHJpdmF0ZS1ib2R5",
    payload: {
      headers: [
        { name: "From", value: "Founder <founder@example.test>" },
        { name: "Subject", value: "Re: A practical idea" },
        {
          name: "Message-ID",
          value:
            "<growthos.123e4567-e89b-42d3-a456-426614174000@faithfulsoftware.dev>",
        },
        { name: "Auto-Submitted", value: "no" },
        { name: "To", value: "to@example.test" },
        { name: "Cc", value: "cc@example.test" },
        { name: "Bcc", value: "bcc@example.test" },
        { name: "In-Reply-To", value: "<previous@example.test>" },
        { name: "References", value: "<previous@example.test>" },
      ],
    },
    ...overrides,
  };
}

test("lists one bounded page of message history", async () => {
  let historyRequest: Request | undefined;
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      if (String(input).endsWith("/token")) return tokenResponse();
      historyRequest = new Request(input, init);
      return Response.json({
        history: [
          {
            id: "201",
            messagesAdded: [
              { message: { id: "added-message", threadId: "thread-id" } },
            ],
            messagesDeleted: [
              { message: { id: "deleted-message", threadId: "thread-id" } },
            ],
          },
        ],
        nextPageToken: "next-page",
        historyId: "300",
      });
    },
  });

  assert.deepEqual(
    await client.listHistory({
      startHistoryId: "100",
      pageToken: "current-page",
    }),
    {
      historyId: "300",
      records: [
        {
          historyId: "201",
          messagesAdded: [
            { messageId: "added-message", gmailThreadId: "thread-id" },
          ],
          messagesDeleted: [
            { messageId: "deleted-message", gmailThreadId: "thread-id" },
          ],
        },
      ],
      nextPageToken: "next-page",
    },
  );
  assert.equal(historyRequest?.method, "GET");
  const url = new URL(historyRequest?.url ?? "https://invalid.test");
  assert.equal(url.pathname, "/gmail/v1/users/me/history");
  assert.deepEqual(Array.from(url.searchParams.entries()), [
    ["startHistoryId", "100"],
    ["maxResults", "500"],
    ["historyTypes", "messageAdded"],
    ["historyTypes", "messageDeleted"],
    ["pageToken", "current-page"],
  ]);
});

test("returns empty history records when Gmail has no changes", async () => {
  const client = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse()
        : Response.json({ historyId: "300" }),
  });

  assert.deepEqual(await client.listHistory({ startHistoryId: "299" }), {
    historyId: "300",
    records: [],
  });
});

test("maps an expired Gmail history cursor to a distinct safe error", async () => {
  const client = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse()
        : Response.json(
            { error: { message: "private provider detail" } },
            { status: 404 },
          ),
  });

  await assert.rejects(
    client.listHistory({ startHistoryId: "100" }),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "HISTORY_ID_EXPIRED" &&
      error.retryable === false &&
      !error.message.includes("private"),
  );
});

test("fetches only reconciliation metadata and normalises selected headers", async () => {
  let metadataRequest: Request | undefined;
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      if (String(input).endsWith("/token")) return tokenResponse();
      metadataRequest = new Request(input, init);
      return Response.json(metadataResponse());
    },
  });

  assert.deepEqual(await client.getMessageMetadata("message-id"), {
    messageId: "message-id",
    gmailThreadId: "thread-id",
    historyId: "301",
    labelIds: ["INBOX"],
    receivedAt: "2026-08-17T13:20:00.000Z",
    from: "Founder <founder@example.test>",
    to: "to@example.test",
    cc: "cc@example.test",
    bcc: "bcc@example.test",
    inReplyTo: "<previous@example.test>",
    references: "<previous@example.test>",
    subject: "Re: A practical idea",
    rfcMessageId:
      "<growthos.123e4567-e89b-42d3-a456-426614174000@faithfulsoftware.dev>",
    autoSubmitted: "no",
    precedence: null,
    returnPath: null,
    autoResponseSuppress: null,
  });
  const url = new URL(metadataRequest?.url ?? "https://invalid.test");
  assert.equal(url.pathname, "/gmail/v1/users/me/messages/message-id");
  assert.equal(url.searchParams.get("format"), "METADATA");
  assert.deepEqual(url.searchParams.getAll("metadataHeaders"), [
    "From",
    "To",
    "Cc",
    "Bcc",
    "In-Reply-To",
    "References",
    "Subject",
    "Message-ID",
    "Auto-Submitted",
    "Precedence",
    "Return-Path",
    "X-Auto-Response-Suppress",
  ]);
});

test("finds an exact deterministic RFC Message-ID via Gmail search", async () => {
  const requests: Request[] = [];
  const rfcMessageId =
    "<growthos.123e4567-e89b-42d3-a456-426614174000@faithfulsoftware.dev>";
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      const request = new Request(input, init);
      if (request.url.endsWith("/token")) return tokenResponse();
      requests.push(request);
      return request.url.includes("/messages?")
        ? Response.json({
            messages: [{ id: "message-id", threadId: "thread-id" }],
            resultSizeEstimate: 1,
          })
        : Response.json(metadataResponse());
    },
  });

  const result = await client.findByRfcMessageId(rfcMessageId);

  assert.equal(result?.messageId, "message-id");
  const searchUrl = new URL(requests[0]?.url ?? "https://invalid.test");
  assert.equal(searchUrl.pathname, "/gmail/v1/users/me/messages");
  assert.equal(searchUrl.searchParams.get("q"), `rfc822msgid:${rfcMessageId}`);
  assert.equal(searchUrl.searchParams.get("maxResults"), "10");
  assert.equal(searchUrl.searchParams.get("includeSpamTrash"), "true");
});

test("returns null when the deterministic RFC Message-ID is absent", async () => {
  const client = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse()
        : Response.json({ resultSizeEstimate: 0 }),
  });

  assert.equal(
    await client.findByRfcMessageId(
      "<growthos.123e4567-e89b-42d3-a456-426614174000@faithfulsoftware.dev>",
    ),
    null,
  );
});

test("does not reconcile a fuzzy search candidate without the exact RFC Message-ID", async () => {
  for (const candidateRfcMessageId of [
    null,
    "<different.123e4567-e89b-42d3-a456-426614174000@example.test>",
  ]) {
    const headers = [
      { name: "From", value: "Founder <founder@example.test>" },
      { name: "Subject", value: "Re: A practical idea" },
      ...(candidateRfcMessageId
        ? [{ name: "Message-ID", value: candidateRfcMessageId }]
        : []),
    ];
    const client = createGmailClient(config, {
      fetch: async (input) => {
        const url = String(input);
        if (url.endsWith("/token")) return tokenResponse();
        return url.includes("/messages?")
          ? Response.json({
              messages: [{ id: "message-id", threadId: "thread-id" }],
              resultSizeEstimate: 1,
            })
          : Response.json(metadataResponse({ payload: { headers } }));
      },
    });

    assert.equal(
      await client.findByRfcMessageId(
        "<growthos.123e4567-e89b-42d3-a456-426614174000@faithfulsoftware.dev>",
      ),
      null,
    );
  }
});

test("rejects duplicate case-varied selected metadata headers", async () => {
  const client = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse()
        : Response.json(
            metadataResponse({
              payload: {
                headers: [
                  {
                    name: "Message-ID",
                    value:
                      "<growthos.123e4567-e89b-42d3-a456-426614174000@faithfulsoftware.dev>",
                  },
                  {
                    name: "message-id",
                    value: "<different@example.test>",
                  },
                ],
              },
            }),
          ),
  });

  await assert.rejects(
    client.getMessageMetadata("message-id"),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE",
  );
});

test("rejects invalid reconciliation inputs and ambiguous provider results", async () => {
  let providerRequests = 0;
  const invalidInputClient = createGmailClient(config, {
    fetch: async () => {
      providerRequests += 1;
      return tokenResponse();
    },
  });
  await assert.rejects(
    invalidInputClient.listHistory({ startHistoryId: "not-numeric" }),
    TypeError,
  );
  await assert.rejects(invalidInputClient.getMessageMetadata(" "), TypeError);
  await assert.rejects(
    invalidInputClient.findByRfcMessageId("<attacker@example.test>"),
    TypeError,
  );
  assert.equal(providerRequests, 0);

  const ambiguousClient = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse()
        : Response.json({
            messages: [
              { id: "message-one", threadId: "thread-id" },
              { id: "message-two", threadId: "thread-id" },
            ],
            resultSizeEstimate: 2,
          }),
  });
  await assert.rejects(
    ambiguousClient.findByRfcMessageId(
      "<growthos.123e4567-e89b-42d3-a456-426614174000@faithfulsoftware.dev>",
    ),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE",
  );

  const mismatchedMetadataClient = createGmailClient(config, {
    fetch: async (input) =>
      String(input).endsWith("/token")
        ? tokenResponse()
        : Response.json(metadataResponse({ id: "another-message" })),
  });
  await assert.rejects(
    mismatchedMetadataClient.getMessageMetadata("message-id"),
    (error: unknown) =>
      error instanceof GmailClientError &&
      error.code === "INVALID_PROVIDER_RESPONSE",
  );
});

test("includes label transitions when requested for Sent observation", async () => {
  let historyRequest: Request | undefined;
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      if (String(input).endsWith("/token")) return tokenResponse();
      historyRequest = new Request(input, init);
      return Response.json({
        historyId: "204",
        history: [
          {
            id: "203",
            labelsAdded: [
              { message: { id: "m1", threadId: "t1" }, labelIds: ["SENT"] },
            ],
            labelsRemoved: [
              { message: { id: "m2", threadId: "t2" }, labelIds: ["SENT"] },
            ],
          },
        ],
      });
    },
  });
  const result = await client.listHistory({
    startHistoryId: "200",
    includeLabelChanges: true,
  });
  assert.deepEqual(
    new URL(historyRequest!.url).searchParams.getAll("historyTypes"),
    ["messageAdded", "messageDeleted", "labelAdded", "labelRemoved"],
  );
  assert.deepEqual(result.records[0]?.labelsAdded, [
    { messageId: "m1", gmailThreadId: "t1", labelIds: ["SENT"] },
  ]);
  assert.deepEqual(result.records[0]?.labelsRemoved, [
    { messageId: "m2", gmailThreadId: "t2", labelIds: ["SENT"] },
  ]);
});

test("lists at most 100 Sent messages including trash without a date filter", async () => {
  let request: Request | undefined;
  const client = createGmailClient(config, {
    fetch: async (input, init) => {
      if (String(input).endsWith("/token")) return tokenResponse();
      request = new Request(input, init);
      return Response.json({
        messages: [{ id: "m1", threadId: "t1" }],
        nextPageToken: "next",
      });
    },
  });
  const page = await client.listSentMessages({ pageToken: "p" });
  const url = new URL(request!.url);
  assert.equal(url.searchParams.get("maxResults"), "100");
  assert.equal(url.searchParams.get("labelIds"), "SENT");
  assert.equal(url.searchParams.get("includeSpamTrash"), "true");
  assert.equal(url.searchParams.get("q"), null);
  assert.equal(url.searchParams.get("pageToken"), "p");
  assert.deepEqual(page, {
    messages: [{ messageId: "m1", gmailThreadId: "t1" }],
    nextPageToken: "next",
  });
});

test("validates SENT observations without claiming internalDate is a transmission time", async () => {
  const { validateGmailSentObservation } = await import("./reconciliation");
  const binding = {
    connectionId: "account",
    googleSubject: "subject",
    grantEpoch: 1,
    grantedScopes: [
      "openid",
      "email",
      "https://www.googleapis.com/auth/gmail.modify",
    ],
  };
  const metadata = {
    messageId: "m1",
    gmailThreadId: "t1",
    historyId: "100",
    labelIds: ["SENT"],
    receivedAt: "2026-11-01T12:00:00.000Z",
    from: "founder@example.test",
    to: "a@example.test",
    cc: null,
    bcc: null,
    inReplyTo: null,
    references: null,
    subject: null,
    rfcMessageId: "<expected@example.test>",
    autoSubmitted: null,
    precedence: null,
    returnPath: null,
    autoResponseSuppress: null,
  };
  const input = {
    binding,
    currentBinding: binding,
    profile: { emailAddress: "founder@example.test", historyId: "100" },
    expectedEmail: "founder@example.test",
    expectedRfcMessageId: "<expected@example.test>",
    metadata,
    observedFrom: new Date("2026-11-17T12:00:00Z"),
    observedUntil: new Date("2026-11-17T12:00:01Z"),
  };
  const result = validateGmailSentObservation(input);
  assert.equal(result.kind, "observed");
  if (result.kind === "observed") {
    assert.equal(result.providerCreatedAt.toISOString(), metadata.receivedAt);
    assert.equal(
      result.observedUntil.toISOString(),
      "2026-11-17T12:00:01.000Z",
    );
  }
  assert.equal(
    validateGmailSentObservation({
      ...input,
      metadata: { ...metadata, labelIds: ["DRAFT"] },
    }).kind,
    "unknown",
  );
  assert.equal(
    validateGmailSentObservation({
      ...input,
      currentBinding: { ...binding, grantEpoch: 2 },
    }).kind,
    "unknown",
  );
  assert.equal(
    validateGmailSentObservation({
      ...input,
      metadata: { ...metadata, receivedAt: "2026-11-18T00:00:00.000Z" },
    }).kind,
    "unknown",
  );
});
