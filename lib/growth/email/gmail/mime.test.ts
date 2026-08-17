import assert from "node:assert/strict";
import test from "node:test";

import { renderGmailMime, type GmailMessageInput } from "./mime";

const messageId = "123e4567-e89b-42d3-a456-426614174000";

const input: GmailMessageInput = {
  id: messageId,
  from: "j.ntagengwa@faithfulsoftware.dev",
  to: "founder@example.test",
  replyTo: "j.ntagengwa@faithfulsoftware.dev",
  subject: "A practical idea for Café Example",
  text: "Hello Café Example,\n\nA practical idea.",
  html: "<p>Hello Café Example,</p><p>A practical idea.</p>",
};

function decodeRaw(raw: string): string {
  return Buffer.from(raw, "base64url").toString("utf8");
}

function decodeMimeParts(mime: string): string[] {
  return Array.from(
    mime.matchAll(
      /Content-Transfer-Encoding: base64\r\n\r\n([A-Za-z0-9+/=\r\n]+?)\r\n--/g,
    ),
    (match) =>
      Buffer.from(match[1].replace(/\r\n/g, ""), "base64").toString("utf8"),
  );
}

function decodeSubject(mime: string): string {
  const headerLines = mime.split("\r\n\r\n", 1)[0].split("\r\n");
  const subjectStart = headerLines.findIndex((line) =>
    line.startsWith("Subject: "),
  );
  const subjectLines = headerLines
    .slice(subjectStart)
    .filter((line, index) => index === 0 || line.startsWith(" "));

  return Array.from(
    subjectLines.join(" ").matchAll(/=\?UTF-8\?B\?([^?]+)\?=/g),
    (match) => Buffer.from(match[1], "base64").toString("utf8"),
  ).join("");
}

test("renders deterministic multipart Gmail MIME with CRLF and RFC 2047 subject", () => {
  const first = renderGmailMime(input);
  const second = renderGmailMime(input);
  const mime = decodeRaw(first.raw);

  assert.deepEqual(second, first);
  assert.equal(
    first.rfcMessageId,
    `<growthos.${messageId}@faithfulsoftware.dev>`,
  );
  assert.equal(first.gmailThreadId, undefined);
  assert.doesNotMatch(mime, /(^|[^\r])\n/);
  assert.match(
    mime,
    /Subject: =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=(?:\r\n =\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=)*/,
  );
  assert.match(mime, /MIME-Version: 1\.0\r\n/);
  assert.match(mime, /Content-Type: multipart\/alternative; boundary="[^"]+"/);
  assert.deepEqual(decodeMimeParts(mime), [input.text, input.html]);
  assert.match(
    mime,
    new RegExp(
      `Message-ID: <growthos\\.${messageId}@faithfulsoftware\\.dev>\\r\\n`,
    ),
  );
});

test("folds a long multibyte subject without splitting characters", () => {
  const subject = "A café workflow ☕ for a growing Kent business "
    .repeat(5)
    .trim();
  const mime = decodeRaw(renderGmailMime({ ...input, subject }).raw);
  const headerLines = mime.split("\r\n\r\n", 1)[0].split("\r\n");
  const subjectStart = headerLines.findIndex((line) =>
    line.startsWith("Subject: "),
  );
  const subjectLines = headerLines
    .slice(subjectStart)
    .filter((line, index) => index === 0 || line.startsWith(" "));

  assert.equal(decodeSubject(mime), subject);
  assert.equal(
    subjectLines.every((line) => line.length <= 76),
    true,
  );
});

test("renders follow-up threading headers and returns the Gmail thread ID", () => {
  const parentMessageId =
    "<growthos.aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa@faithfulsoftware.dev>";
  const earlierReference = "<earlier@example.test>";
  const rendered = renderGmailMime({
    ...input,
    id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
    thread: {
      gmailThreadId: "gmail-thread-id",
      parentMessageId,
      references: [earlierReference],
    },
  });
  const mime = decodeRaw(rendered.raw);

  assert.equal(rendered.gmailThreadId, "gmail-thread-id");
  assert.match(mime, new RegExp(`In-Reply-To: ${parentMessageId}`));
  assert.match(
    mime,
    new RegExp(
      `References: ${earlierReference}(?: |\\r\\n )${parentMessageId}`,
    ),
  );
  assert.equal(
    mime.match(/^Subject: .+(?:\r\n .+)*$/m)?.[0],
    decodeRaw(renderGmailMime(input).raw).match(
      /^Subject: .+(?:\r\n .+)*$/m,
    )?.[0],
  );
});

test("emits unpadded base64url and rejects header injection", () => {
  const rendered = renderGmailMime(input);

  assert.match(rendered.raw, /^[A-Za-z0-9_-]+$/);
  assert.doesNotMatch(rendered.raw, /[+/=]/);

  for (const unsafe of [
    { ...input, subject: "Safe\r\nBcc: attacker@example.test" },
    { ...input, to: "founder@example.test\nBcc: attacker@example.test" },
    { ...input, replyTo: "safe@example.test\rInjected: yes" },
    {
      ...input,
      thread: {
        gmailThreadId: "thread-id",
        parentMessageId: "<safe@example.test>\r\nBcc: attacker@example.test",
        references: [],
      },
    },
  ]) {
    assert.throws(() => renderGmailMime(unsafe), /invalid|header/i);
  }
});

test("rejects malformed mailbox dot-atoms and domain labels", () => {
  for (const mailbox of [
    ".founder@example.test",
    "founder..name@example.test",
    "founder@example..test",
    "founder@example.-test",
    "founder@-example.test",
    `${"a".repeat(65)}@example.test`,
  ]) {
    assert.throws(() => renderGmailMime({ ...input, to: mailbox }), /header/i);
  }
});

test("keeps every physical header within the RFC 5322 hard line limit", () => {
  const maximumParentId = `<${"a".repeat(970)}@example.test>`;
  const mime = decodeRaw(
    renderGmailMime({
      ...input,
      thread: {
        gmailThreadId: "gmail-thread-id",
        parentMessageId: maximumParentId,
        references: [],
      },
    }).raw,
  );

  assert.equal(
    mime.split("\r\n").every((line) => line.length <= 998),
    true,
  );
  assert.throws(
    () =>
      renderGmailMime({
        ...input,
        thread: {
          gmailThreadId: "gmail-thread-id",
          parentMessageId: `<${"a".repeat(971)}@example.test>`,
          references: [],
        },
      }),
    /header/i,
  );
});

test("rejects malformed Message-ID dot-atoms in parents and references", () => {
  const validParent = "<parent@example.test>";
  for (const invalidMessageId of [
    "<id..part@example.test>",
    "<id@example..test>",
    "<id@.example.test>",
    "<id@example.test.>",
  ]) {
    assert.throws(
      () =>
        renderGmailMime({
          ...input,
          thread: {
            gmailThreadId: "gmail-thread-id",
            parentMessageId: invalidMessageId,
            references: [],
          },
        }),
      /header/i,
    );
    assert.throws(
      () =>
        renderGmailMime({
          ...input,
          thread: {
            gmailThreadId: "gmail-thread-id",
            parentMessageId: validParent,
            references: [invalidMessageId],
          },
        }),
      /header/i,
    );
  }
});

test("accepts RFC no-fold literals containing an at sign", () => {
  const parentMessageId = "<parent@[opaque@literal]>";
  const referenceMessageId = "<earlier@[IPv6:2001:db8::1]>";
  const mime = decodeRaw(
    renderGmailMime({
      ...input,
      thread: {
        gmailThreadId: "gmail-thread-id",
        parentMessageId,
        references: [referenceMessageId],
      },
    }).raw,
  );

  assert.equal(mime.includes(`In-Reply-To: ${parentMessageId}\r\n`), true);
  assert.equal(mime.includes(referenceMessageId), true);
  assert.equal(mime.includes(parentMessageId), true);
});

test("rejects a non-UUID message identity", () => {
  assert.throws(
    () => renderGmailMime({ ...input, id: "predictable-message" }),
    /UUID/i,
  );
});
