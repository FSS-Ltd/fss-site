const CRLF = "\r\n";
const MESSAGE_DOMAIN = "faithfulsoftware.dev";
const MAX_ENCODED_WORD_BYTES = 39;
const MAX_MESSAGE_ID_LENGTH = 998 - "In-Reply-To: ".length;
const MAX_REFERENCES = 50;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DOT_ATOM_PATTERN =
  /^[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+(?:\.[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~]+)*$/;
const DOMAIN_LABEL_PATTERN = /^[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?$/;
const NO_FOLD_LITERAL_PATTERN = /^\[[\x21-\x5a\x5e-\x7e]+\]$/;
const HEADER_CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const GMAIL_THREAD_ID_PATTERN = /^[A-Za-z0-9_-]+$/;

export type GmailMessageInput = {
  id: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo: string;
  thread?: {
    gmailThreadId: string;
    parentMessageId: string;
    references: string[];
  };
};

export type RenderedGmailMessage = {
  raw: string;
  rfcMessageId: string;
  gmailThreadId?: string;
};

function requireHeaderText(value: string, label: string): string {
  const trimmed = value.trim();
  if (!trimmed || HEADER_CONTROL_PATTERN.test(trimmed)) {
    throw new TypeError(`${label} header is invalid.`);
  }
  return trimmed;
}

function requireMailbox(value: string, label: string): string {
  const mailbox = requireHeaderText(value, label);
  const separator = mailbox.lastIndexOf("@");
  const localPart = mailbox.slice(0, separator);
  const domain = mailbox.slice(separator + 1);
  const domainLabels = domain.split(".");
  if (
    separator < 1 ||
    mailbox.indexOf("@") !== separator ||
    mailbox.length > 254 ||
    localPart.length > 64 ||
    !DOT_ATOM_PATTERN.test(localPart) ||
    domain.length > 253 ||
    domainLabels.some(
      (domainLabel) =>
        domainLabel.length > 63 || !DOMAIN_LABEL_PATTERN.test(domainLabel),
    )
  ) {
    throw new TypeError(`${label} header is invalid.`);
  }
  return mailbox;
}

function requireMessageId(value: string, label: string): string {
  const messageId = requireHeaderText(value, label);
  const inner = messageId.slice(1, -1);
  const separator = inner.indexOf("@");
  const left = inner.slice(0, separator);
  const right = inner.slice(separator + 1);
  if (
    messageId.length > MAX_MESSAGE_ID_LENGTH ||
    !messageId.startsWith("<") ||
    !messageId.endsWith(">") ||
    separator < 1 ||
    !DOT_ATOM_PATTERN.test(left) ||
    (!DOT_ATOM_PATTERN.test(right) && !NO_FOLD_LITERAL_PATTERN.test(right))
  ) {
    throw new TypeError(`${label} header is invalid.`);
  }
  return messageId;
}

function encodeSubject(value: string): string {
  const subject = requireHeaderText(value, "Subject");
  if (subject.length > 998) {
    throw new TypeError("Subject header is invalid.");
  }

  const chunks: string[] = [];
  let chunk = "";
  for (const character of subject) {
    if (
      chunk &&
      Buffer.byteLength(chunk + character, "utf8") > MAX_ENCODED_WORD_BYTES
    ) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk += character;
    }
  }
  if (chunk) chunks.push(chunk);

  return chunks
    .map(
      (part) => `=?UTF-8?B?${Buffer.from(part, "utf8").toString("base64")}?=`,
    )
    .join(`${CRLF} `);
}

function foldMessageIds(name: string, messageIds: readonly string[]): string {
  const lines: string[] = [];
  let line = `${name}:`;

  for (const messageId of messageIds) {
    const addition = ` ${messageId}`;
    if (line.length + addition.length > 78 && line !== `${name}:`) {
      lines.push(line);
      line = ` ${messageId}`;
    } else {
      line += addition;
    }
  }
  lines.push(line);
  return lines.join(CRLF);
}

function encodeBody(value: string, label: string): string {
  if (!value.trim()) {
    throw new TypeError(`${label} body is invalid.`);
  }

  const encoded = Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join(CRLF) ?? "";
}

function renderThreadHeaders(thread: GmailMessageInput["thread"]): {
  headers: string[];
  gmailThreadId?: string;
} {
  if (!thread) return { headers: [] };

  const gmailThreadId = requireHeaderText(
    thread.gmailThreadId,
    "Gmail thread ID",
  );
  if (
    gmailThreadId.length > 256 ||
    !GMAIL_THREAD_ID_PATTERN.test(gmailThreadId)
  ) {
    throw new TypeError("Gmail thread ID is invalid.");
  }
  if (thread.references.length > MAX_REFERENCES) {
    throw new TypeError("References header is invalid.");
  }

  const parentMessageId = requireMessageId(
    thread.parentMessageId,
    "In-Reply-To",
  );
  const references = Array.from(
    new Set([
      ...thread.references.map((reference) =>
        requireMessageId(reference, "References"),
      ),
      parentMessageId,
    ]),
  );

  return {
    headers: [
      `In-Reply-To: ${parentMessageId}`,
      foldMessageIds("References", references),
    ],
    gmailThreadId,
  };
}

export function renderGmailMime(
  input: GmailMessageInput,
): RenderedGmailMessage {
  if (!UUID_PATTERN.test(input.id)) {
    throw new TypeError("Gmail message ID must be a UUID.");
  }

  const id = input.id.toLowerCase();
  const rfcMessageId = `<growthos.${id}@${MESSAGE_DOMAIN}>`;
  const boundary = `growthos_alt_${id.replaceAll("-", "")}`;
  const thread = renderThreadHeaders(input.thread);
  const headers = [
    `From: ${requireMailbox(input.from, "From")}`,
    `To: ${requireMailbox(input.to, "To")}`,
    `Reply-To: ${requireMailbox(input.replyTo, "Reply-To")}`,
    `Subject: ${encodeSubject(input.subject)}`,
    `Message-ID: ${rfcMessageId}`,
    ...thread.headers,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
  ];
  const parts = [
    [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      encodeBody(input.text, "Plain-text"),
    ].join(CRLF),
    [
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      encodeBody(input.html, "HTML"),
    ].join(CRLF),
  ];
  const mime = [headers.join(CRLF), "", ...parts, `--${boundary}--`, ""].join(
    CRLF,
  );

  return {
    raw: Buffer.from(mime, "utf8").toString("base64url"),
    rfcMessageId,
    gmailThreadId: thread.gmailThreadId,
  };
}
