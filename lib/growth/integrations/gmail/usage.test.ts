import assert from "node:assert/strict";
import test from "node:test";
import type { GmailClient, GmailMessageMetadata } from "./types";
import { observeGmailUsage } from "./usage";

const email = "founder@example.test";
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
const metadata: GmailMessageMetadata = {
  messageId: "m1",
  gmailThreadId: "t1",
  historyId: "101",
  labelIds: ["SENT"],
  receivedAt: "2026-11-01T12:00:00.000Z",
  from: email,
  to: "a@example.test",
  cc: "b@example.test",
  bcc: "c@example.test",
  inReplyTo: null,
  references: null,
  subject: null,
  rfcMessageId: null,
  autoSubmitted: null,
  precedence: null,
  returnPath: null,
  autoResponseSuppress: null,
};
const clock =
  (...dates: string[]) =>
  () => {
    const value = dates.shift();
    if (!value) throw new Error("clock exhausted");
    return new Date(value);
  };
function client(
  overrides: Partial<
    Pick<
      GmailClient,
      "getProfile" | "listSentMessages" | "listHistory" | "getMessageMetadata"
    >
  > = {},
): Pick<
  GmailClient,
  "getProfile" | "listSentMessages" | "listHistory" | "getMessageMetadata"
> {
  return {
    getProfile: async () => ({ emailAddress: email, historyId: "100" }),
    listSentMessages: async () => ({ messages: [] }),
    listHistory: async () => ({ historyId: "100", records: [] }),
    getMessageMetadata: async () => metadata,
    ...overrides,
  };
}

test("a forward baseline is held until a full day of closed history", async () => {
  const baseline = await observeGmailUsage({
    client: client(),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  assert.equal(baseline.status, "held");
  assert.equal(baseline.reason, "baseline_unmatured");
  const next = await observeGmailUsage({
    client: client({
      getProfile: async () => ({ emailAddress: email, historyId: "101" }),
      listHistory: async () => ({ historyId: "101", records: [] }),
    }),
    binding,
    subjectEmail: email,
    prior: baseline.state,
    now: clock("2026-11-17T12:00:00Z", "2026-11-17T12:00:01Z"),
  });
  assert.equal(next.status, "complete");
  assert.equal(next.state.observations.length, 0);
});

test("counts actual To, Cc and Bcc occurrences with observation upper bound", async () => {
  const baseline = await observeGmailUsage({
    client: client({
      listSentMessages: async () => ({
        messages: [{ messageId: "m1", gmailThreadId: "t1" }],
      }),
    }),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  assert.equal(baseline.state.observations[0]?.recipientCount, 3);
  assert.equal(
    baseline.state.observations[0]?.observedUpperBound,
    "2026-11-16T12:00:01.000Z",
  );
  assert.equal(
    baseline.state.observations[0]?.internalDate,
    metadata.receivedAt,
  );
});

test("holds an initial scan that exceeds ten pages without a fake zero", async () => {
  let pages = 0;
  const result = await observeGmailUsage({
    client: client({
      listSentMessages: async () => ({
        messages: [],
        nextPageToken: String(++pages),
      }),
    }),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  assert.equal(result.status, "held");
  if (result.status === "held") assert.equal(result.reason, "sent_list_limit");
  assert.equal(pages, 10);
});

test("holds duplicate listed IDs and missing recipient evidence", async () => {
  for (const badClient of [
    client({
      listSentMessages: async () => ({
        messages: [
          { messageId: "m1", gmailThreadId: "t1" },
          { messageId: "m1", gmailThreadId: "t1" },
        ],
      }),
    }),
    client({
      listSentMessages: async () => ({
        messages: [{ messageId: "m1", gmailThreadId: "t1" }],
      }),
      getMessageMetadata: async () => ({
        ...metadata,
        to: null,
        cc: null,
        bcc: null,
      }),
    }),
  ]) {
    const result = await observeGmailUsage({
      client: badClient,
      binding,
      subjectEmail: email,
      prior: null,
      now: clock(
        "2026-11-16T11:59:59Z",
        "2026-11-16T12:00:00Z",
        "2026-11-16T12:00:01Z",
      ),
    });
    assert.equal(result.status, "held");
    if (result.status === "held")
      assert.notEqual(result.reason, "baseline_unmatured");
  }
});

test("deduplicates one SENT transition represented by two history fields", async () => {
  const baseline = await observeGmailUsage({
    client: client(),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  let reads = 0;
  const result = await observeGmailUsage({
    client: client({
      getProfile: async () => ({ emailAddress: email, historyId: "102" }),
      listHistory: async () => ({
        historyId: "102",
        records: [
          {
            historyId: "101",
            messagesAdded: [{ messageId: "m1", gmailThreadId: "t1" }],
            messagesDeleted: [],
            labelsAdded: [
              { messageId: "m1", gmailThreadId: "t1", labelIds: ["SENT"] },
            ],
            labelsRemoved: [],
          },
        ],
      }),
      getMessageMetadata: async () => {
        reads++;
        return metadata;
      },
    }),
    binding,
    subjectEmail: email,
    prior: baseline.state,
    now: clock("2026-11-17T12:00:00Z", "2026-11-17T12:00:02Z"),
  });
  assert.equal(result.status, "complete");
  assert.equal(reads, 1);
  assert.equal(result.state.observations.length, 1);
  assert.equal(
    result.state.observations[0]?.observedUpperBound,
    "2026-11-17T12:00:02.000Z",
  );
  assert.equal(
    result.state.observations.reduce(
      (sum, item) => sum + item.recipientCount,
      0,
    ),
    3,
  );
});

test("deletion establishes a new hold while retaining known exposure", async () => {
  const baseline = await observeGmailUsage({
    client: client({
      listSentMessages: async () => ({
        messages: [{ messageId: "m1", gmailThreadId: "t1" }],
      }),
    }),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  const result = await observeGmailUsage({
    client: client({
      getProfile: async () => ({ emailAddress: email, historyId: "101" }),
      listHistory: async () => ({
        historyId: "101",
        records: [
          {
            historyId: "101",
            messagesAdded: [],
            messagesDeleted: [{ messageId: "m1", gmailThreadId: "t1" }],
            labelsAdded: [],
            labelsRemoved: [],
          },
        ],
      }),
    }),
    binding,
    subjectEmail: email,
    prior: baseline.state,
    now: clock("2026-11-17T11:59:59Z", "2026-11-17T12:00:01Z"),
  });
  assert.equal(result.status, "held");
  assert.equal(result.state.observations.length, 1);
  assert.equal(
    result.state.baselineAt.toISOString(),
    "2026-11-17T12:00:01.000Z",
  );
});

test("rejects a prior observation bound to a different grant", async () => {
  const baseline = await observeGmailUsage({
    client: client(),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  await assert.rejects(
    observeGmailUsage({
      client: client(),
      binding: { ...binding, grantEpoch: 2 },
      subjectEmail: email,
      prior: baseline.state,
      now: clock("2026-11-17T12:00:00Z", "2026-11-17T12:00:01Z"),
    }),
    /grant/i,
  );
});

test("never reads more than 1000 metadata records on an overflowing Sent baseline", async () => {
  let page = 0;
  let reads = 0;
  const result = await observeGmailUsage({
    client: client({
      listSentMessages: async () => {
        const start = page++ * 100;
        return {
          messages: Array.from({ length: 100 }, (_, n) => ({
            messageId: `m${start + n}`,
            gmailThreadId: "t1",
          })),
          nextPageToken: `page-${page}`,
        };
      },
      getMessageMetadata: async (id) => {
        reads++;
        return { ...metadata, messageId: id };
      },
    }),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  assert.equal(result.status, "held");
  assert.equal(reads, 1000);
  assert.equal(result.state.observations.length, 1000);
});

test("a repeated history page token creates a new unknown exposure window", async () => {
  const baseline = await observeGmailUsage({
    client: client(),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  const result = await observeGmailUsage({
    client: client({
      listHistory: async () => ({
        historyId: "100",
        records: [],
        nextPageToken: "repeat",
      }),
    }),
    binding,
    subjectEmail: email,
    prior: baseline.state,
    now: clock("2026-11-17T12:00:00Z", "2026-11-17T12:00:01Z"),
  });
  assert.equal(result.status, "held");
  if (result.status === "held")
    assert.equal(result.reason, "history_page_loop");
  assert.equal(
    result.state.baselineAt.toISOString(),
    "2026-11-17T12:00:01.000Z",
  );
});

test("changed recipients on a repeated message cannot replace prior evidence", async () => {
  const baseline = await observeGmailUsage({
    client: client({
      listSentMessages: async () => ({
        messages: [{ messageId: "m1", gmailThreadId: "t1" }],
      }),
    }),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  const result = await observeGmailUsage({
    client: client({
      getProfile: async () => ({ emailAddress: email, historyId: "101" }),
      listHistory: async () => ({
        historyId: "101",
        records: [
          {
            historyId: "101",
            messagesAdded: [],
            messagesDeleted: [],
            labelsAdded: [
              { messageId: "m1", gmailThreadId: "t1", labelIds: ["SENT"] },
            ],
            labelsRemoved: [],
          },
        ],
      }),
      getMessageMetadata: async () => ({ ...metadata, bcc: null }),
    }),
    binding,
    subjectEmail: email,
    prior: baseline.state,
    now: clock("2026-11-17T11:59:59Z", "2026-11-17T12:00:01Z"),
  });
  assert.equal(result.status, "held");
  assert.equal(result.state.observations[0]?.recipientCount, 3);
});

test("provider errors do not leak details into the held reason", async () => {
  const result = await observeGmailUsage({
    client: client({
      listSentMessages: async () => {
        throw new Error("private token");
      },
    }),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  assert.equal(result.status, "held");
  if (result.status === "held")
    assert.equal(result.reason, "sent_observation_incomplete");
});

test("stable ordinary inbound additions do not restart the usage baseline", async () => {
  const baseline = await observeGmailUsage({
    client: client(),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  const inbound = { ...metadata, labelIds: ["INBOX"], historyId: "101" };
  const result = await observeGmailUsage({
    client: client({
      getProfile: async () => ({ emailAddress: email, historyId: "102" }),
      listHistory: async () => ({
        historyId: "102",
        records: [
          {
            historyId: "101",
            messagesAdded: [{ messageId: "m1", gmailThreadId: "t1" }],
            messagesDeleted: [],
            labelsAdded: [],
            labelsRemoved: [],
          },
        ],
      }),
      getMessageMetadata: async () => inbound,
    }),
    binding,
    subjectEmail: email,
    prior: baseline.state,
    now: clock("2026-11-17T12:00:00Z", "2026-11-17T12:00:01Z"),
  });
  assert.equal(result.status, "complete");
  assert.equal(result.state.observations.length, 0);
});

test("a later SENT removal or metadata newer than the head holds usage", async () => {
  const baseline = await observeGmailUsage({
    client: client(),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  for (const changed of [false, true]) {
    const result = await observeGmailUsage({
      client: client({
        getProfile: async () => ({ emailAddress: email, historyId: "102" }),
        listHistory: async () => ({
          historyId: "102",
          records: [
            {
              historyId: "101",
              messagesAdded: [{ messageId: "m1", gmailThreadId: "t1" }],
              messagesDeleted: [],
              labelsAdded: [],
              labelsRemoved: changed
                ? [{ messageId: "m1", gmailThreadId: "t1", labelIds: ["SENT"] }]
                : [],
            },
          ],
        }),
        getMessageMetadata: async () => ({
          ...metadata,
          labelIds: ["INBOX"],
          historyId: changed ? "101" : "103",
        }),
      }),
      binding,
      subjectEmail: email,
      prior: baseline.state,
      now: clock("2026-11-17T12:00:00Z", "2026-11-17T12:00:01Z"),
    });
    assert.equal(result.status, "held");
  }
});

test("counts common quoted, Unicode and RFC2047 display names", async () => {
  const sent = {
    ...metadata,
    to: 'José <a@example.test>, "Smith, Jane" <b@example.test>',
    cc: "=?UTF-8?Q?Jos=C3=A9?= <c@example.test>",
    bcc: null,
  };
  const result = await observeGmailUsage({
    client: client({
      listSentMessages: async () => ({
        messages: [{ messageId: "m1", gmailThreadId: "t1" }],
      }),
      getMessageMetadata: async () => sent,
    }),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  assert.equal(result.state.observations[0]?.recipientCount, 3);
});

test("holds ambiguous address syntax instead of undercounting recipients", async () => {
  for (const to of [
    '"Smith, Jane <a@example.test>',
    "Team: a@example.test, b@example.test;",
    "a@example.test <b@example.test>",
  ]) {
    const result = await observeGmailUsage({
      client: client({
        listSentMessages: async () => ({
          messages: [{ messageId: "m1", gmailThreadId: "t1" }],
        }),
        getMessageMetadata: async () => ({
          ...metadata,
          to,
          cc: null,
          bcc: null,
        }),
      }),
      binding,
      subjectEmail: email,
      prior: null,
      now: clock(
        "2026-11-16T11:59:59Z",
        "2026-11-16T12:00:00Z",
        "2026-11-16T12:00:01Z",
      ),
    });
    assert.equal(result.status, "held");
    if (result.status === "held")
      assert.equal(result.reason, "metadata_unknown");
  }
});

test("duplicate or out-of-order history records hold rather than claim continuity", async () => {
  const baseline = await observeGmailUsage({
    client: client(),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  const record = {
    historyId: "101",
    messagesAdded: [],
    messagesDeleted: [],
    labelsAdded: [],
    labelsRemoved: [],
  };
  const result = await observeGmailUsage({
    client: client({
      getProfile: async () => ({ emailAddress: email, historyId: "102" }),
      listHistory: async () => ({
        historyId: "102",
        records: [record, record],
      }),
    }),
    binding,
    subjectEmail: email,
    prior: baseline.state,
    now: clock("2026-11-17T12:00:00Z", "2026-11-17T12:00:01Z"),
  });
  assert.equal(result.status, "held");
  if (result.status === "held") assert.equal(result.reason, "history_invalid");
});

test("same-count recipient metadata changes hold while unchanged evidence can be reused", async () => {
  const baseline = await observeGmailUsage({
    client: client({
      listSentMessages: async () => ({
        messages: [{ messageId: "m1", gmailThreadId: "t1" }],
      }),
    }),
    binding,
    subjectEmail: email,
    prior: null,
    now: clock(
      "2026-11-16T11:59:59Z",
      "2026-11-16T12:00:00Z",
      "2026-11-16T12:00:01Z",
    ),
  });
  const next = (message: GmailMessageMetadata) =>
    observeGmailUsage({
      client: client({
        getProfile: async () => ({ emailAddress: email, historyId: "101" }),
        listHistory: async () => ({
          historyId: "101",
          records: [
            {
              historyId: "101",
              messagesAdded: [],
              messagesDeleted: [],
              labelsAdded: [
                { messageId: "m1", gmailThreadId: "t1", labelIds: ["SENT"] },
              ],
              labelsRemoved: [],
            },
          ],
        }),
        getMessageMetadata: async () => message,
      }),
      binding,
      subjectEmail: email,
      prior: baseline.state,
      now: clock("2026-11-17T11:59:59Z", "2026-11-17T12:00:01Z"),
    });
  const changed = await next({ ...metadata, to: "other@example.test" });
  assert.equal(changed.status, "held");
  if (changed.status === "held")
    assert.equal(changed.reason, "recipient_metadata_changed");
  assert.equal(changed.state.observations.length, 1);
  const unchanged = await next(metadata);
  assert.equal(unchanged.state.observations.length, 2);
});

test("does not observe usage with an unsupported grant", async () => {
  let calls = 0;
  await assert.rejects(
    observeGmailUsage({
      client: client({
        getProfile: async () => {
          calls++;
          return { emailAddress: email, historyId: "100" };
        },
      }),
      binding: { ...binding, grantedScopes: ["email"] },
      subjectEmail: email,
      prior: null,
      now: clock("2026-11-16T12:00:00Z"),
    }),
    /grant/i,
  );
  assert.equal(calls, 0);
});
