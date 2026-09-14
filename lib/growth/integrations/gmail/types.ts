export type GmailProfile = {
  emailAddress: string;
  historyId: string;
};

export type GmailCreateDraftInput = {
  raw: string;
  gmailThreadId?: string;
};

export type GmailSendInput = {
  raw: string;
  gmailThreadId?: string;
};

export type GmailDraftResult = {
  draftId: string;
  messageId: string;
  gmailThreadId: string;
};

export type GmailSendResult = {
  messageId: string;
  gmailThreadId: string;
};

export type GmailHistoryInput = {
  startHistoryId: string;
  pageToken?: string;
};

export type GmailHistoryMessage = {
  messageId: string;
  gmailThreadId: string;
};

export type GmailHistoryRecord = {
  historyId: string;
  messagesAdded: GmailHistoryMessage[];
  messagesDeleted: GmailHistoryMessage[];
};

export type GmailHistoryResult = {
  historyId: string;
  records: GmailHistoryRecord[];
  nextPageToken?: string;
};

export type GmailMessageMetadata = {
  messageId: string;
  gmailThreadId: string;
  historyId: string;
  labelIds: string[];
  receivedAt: string;
  from: string | null;
  subject: string | null;
  rfcMessageId: string | null;
  autoSubmitted: string | null;
  precedence: string | null;
  returnPath: string | null;
  autoResponseSuppress: string | null;
};

export interface GmailClient {
  createDraft(input: GmailCreateDraftInput): Promise<GmailDraftResult>;
  sendDraft(draftId: string): Promise<GmailSendResult>;
  sendMessage(input: GmailSendInput): Promise<GmailSendResult>;
  listHistory(input: GmailHistoryInput): Promise<GmailHistoryResult>;
  getMessageMetadata(messageId: string): Promise<GmailMessageMetadata>;
  findByRfcMessageId(
    rfcMessageId: string,
  ): Promise<GmailMessageMetadata | null>;
  getProfile(): Promise<GmailProfile>;
}

export type GmailClientErrorCode =
  | "AUTHENTICATION_FAILED"
  | "HISTORY_ID_EXPIRED"
  | "RETRYABLE_PROVIDER_ERROR"
  | "PERMANENT_PROVIDER_ERROR"
  | "INVALID_PROVIDER_RESPONSE";

export class GmailClientError extends Error {
  public readonly retryable: boolean;

  constructor(public readonly code: GmailClientErrorCode) {
    super("The Gmail provider request failed.");
    this.name = "GmailClientError";
    this.retryable = code === "RETRYABLE_PROVIDER_ERROR";
  }
}

export class GmailTokenResponseError extends GmailClientError {
  constructor() {
    super("INVALID_PROVIDER_RESPONSE");
    this.name = "GmailTokenResponseError";
  }
}

export class GmailHistoryResponseError extends GmailClientError {
  constructor() {
    super("INVALID_PROVIDER_RESPONSE");
    this.name = "GmailHistoryResponseError";
  }
}
