import { z } from "zod";

import {
  GmailClientError,
  type GmailHistoryInput,
  type GmailHistoryResult,
  type GmailMessageMetadata,
} from "./types";

export type GmailReadContext = "history";
export type GmailJsonReader = (
  pathname: string,
  context?: GmailReadContext,
) => Promise<unknown>;

const MAX_HISTORY_RESULTS = 500;
const MAX_SEARCH_RESULTS = 10;
const METADATA_HEADERS = [
  "From",
  "Subject",
  "Message-ID",
  "Auto-Submitted",
  "Precedence",
  "Return-Path",
  "X-Auto-Response-Suppress",
] as const;
const DETERMINISTIC_MESSAGE_ID_PATTERN =
  /^<growthos\.[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}@faithfulsoftware\.dev>$/;

const opaqueIdSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => value === value.trim());
const historyIdSchema = z.string().regex(/^\d+$/).max(32);
const pageTokenSchema = z
  .string()
  .min(1)
  .max(2048)
  .refine((value) => value === value.trim());
const historyInputSchema = z.object({
  startHistoryId: historyIdSchema,
  pageToken: pageTokenSchema.optional(),
});
const historyMessageSchema = z.object({
  message: z.object({
    id: opaqueIdSchema,
    threadId: opaqueIdSchema,
  }),
});
const historyRecordSchema = z.object({
  id: historyIdSchema,
  messagesAdded: z
    .array(historyMessageSchema)
    .max(MAX_HISTORY_RESULTS)
    .optional(),
  messagesDeleted: z
    .array(historyMessageSchema)
    .max(MAX_HISTORY_RESULTS)
    .optional(),
});
const historyResponseSchema = z.object({
  history: z.array(historyRecordSchema).max(MAX_HISTORY_RESULTS).optional(),
  nextPageToken: pageTokenSchema.optional(),
  historyId: historyIdSchema,
});
const headerSchema = z.object({
  name: z.string().min(1).max(256),
  value: z.string().max(32 * 1024),
});
const messageMetadataResponseSchema = z.object({
  id: opaqueIdSchema,
  threadId: opaqueIdSchema,
  labelIds: z.array(opaqueIdSchema).max(100).optional(),
  historyId: historyIdSchema,
  internalDate: z.string().regex(/^\d{1,16}$/),
  payload: z.object({
    headers: z.array(headerSchema).max(32).optional(),
  }),
});
const messageSearchResponseSchema = z.object({
  messages: z
    .array(
      z.object({
        id: opaqueIdSchema,
        threadId: opaqueIdSchema,
      }),
    )
    .max(MAX_SEARCH_RESULTS)
    .optional(),
  nextPageToken: pageTokenSchema.optional(),
});

function requireValid<T>(
  schema: z.ZodType<T>,
  value: unknown,
  message: string,
): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new TypeError(message);
  return parsed.data;
}

function invalidProviderResponse(): never {
  throw new GmailClientError("INVALID_PROVIDER_RESPONSE");
}

function selectedHeader(
  headers: Array<{ name: string; value: string }>,
  name: (typeof METADATA_HEADERS)[number],
): string | null {
  const values = headers.filter(
    (header) => header.name.toLowerCase() === name.toLowerCase(),
  );
  if (values.length > 1) invalidProviderResponse();
  return values[0]?.value ?? null;
}

function receivedAt(internalDate: string): string {
  const timestamp = Number(internalDate);
  const date = new Date(timestamp);
  if (!Number.isSafeInteger(timestamp) || Number.isNaN(date.getTime())) {
    invalidProviderResponse();
  }
  return date.toISOString();
}

function metadataPath(messageId: string): string {
  const query = new URLSearchParams({ format: "METADATA" });
  for (const header of METADATA_HEADERS) {
    query.append("metadataHeaders", header);
  }
  return `/messages/${encodeURIComponent(messageId)}?${query}`;
}

export async function readGmailHistoryPage(
  readJson: GmailJsonReader,
  input: GmailHistoryInput,
): Promise<GmailHistoryResult> {
  const validInput = requireValid(
    historyInputSchema,
    input,
    "Gmail history input is invalid.",
  );
  const query = new URLSearchParams({
    startHistoryId: validInput.startHistoryId,
    maxResults: String(MAX_HISTORY_RESULTS),
  });
  query.append("historyTypes", "messageAdded");
  query.append("historyTypes", "messageDeleted");
  if (validInput.pageToken) query.append("pageToken", validInput.pageToken);

  const parsed = historyResponseSchema.safeParse(
    await readJson(`/history?${query}`, "history"),
  );
  if (!parsed.success) invalidProviderResponse();

  return {
    historyId: parsed.data.historyId,
    records: (parsed.data.history ?? []).map((record) => ({
      historyId: record.id,
      messagesAdded: (record.messagesAdded ?? []).map(({ message }) => ({
        messageId: message.id,
        gmailThreadId: message.threadId,
      })),
      messagesDeleted: (record.messagesDeleted ?? []).map(({ message }) => ({
        messageId: message.id,
        gmailThreadId: message.threadId,
      })),
    })),
    ...(parsed.data.nextPageToken
      ? { nextPageToken: parsed.data.nextPageToken }
      : {}),
  };
}

export async function readGmailMessageMetadata(
  readJson: GmailJsonReader,
  messageId: string,
): Promise<GmailMessageMetadata> {
  const validMessageId = requireValid(
    opaqueIdSchema,
    messageId,
    "Gmail message ID is invalid.",
  );
  const parsed = messageMetadataResponseSchema.safeParse(
    await readJson(metadataPath(validMessageId)),
  );
  if (!parsed.success || parsed.data.id !== validMessageId) {
    invalidProviderResponse();
  }
  const headers = parsed.data.payload.headers ?? [];

  return {
    messageId: parsed.data.id,
    gmailThreadId: parsed.data.threadId,
    historyId: parsed.data.historyId,
    labelIds: parsed.data.labelIds ?? [],
    receivedAt: receivedAt(parsed.data.internalDate),
    from: selectedHeader(headers, "From"),
    subject: selectedHeader(headers, "Subject"),
    rfcMessageId: selectedHeader(headers, "Message-ID"),
    autoSubmitted: selectedHeader(headers, "Auto-Submitted"),
    precedence: selectedHeader(headers, "Precedence"),
    returnPath: selectedHeader(headers, "Return-Path"),
    autoResponseSuppress: selectedHeader(headers, "X-Auto-Response-Suppress"),
  };
}

export async function findGmailMessageByRfcId(
  readJson: GmailJsonReader,
  rfcMessageId: string,
): Promise<GmailMessageMetadata | null> {
  if (!DETERMINISTIC_MESSAGE_ID_PATTERN.test(rfcMessageId)) {
    throw new TypeError("Gmail RFC Message-ID is invalid.");
  }
  const query = new URLSearchParams({
    q: `rfc822msgid:${rfcMessageId}`,
    maxResults: String(MAX_SEARCH_RESULTS),
    includeSpamTrash: "true",
  });
  const parsed = messageSearchResponseSchema.safeParse(
    await readJson(`/messages?${query}`),
  );
  if (!parsed.success) invalidProviderResponse();
  const candidates = parsed.data.messages ?? [];
  if (parsed.data.nextPageToken || candidates.length > 1) {
    invalidProviderResponse();
  }
  const candidate = candidates[0];
  if (!candidate) return null;

  const metadata = await readGmailMessageMetadata(readJson, candidate.id);
  return metadata.rfcMessageId === rfcMessageId ? metadata : null;
}
