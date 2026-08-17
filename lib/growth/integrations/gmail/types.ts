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

export interface GmailClient {
  createDraft(input: GmailCreateDraftInput): Promise<GmailDraftResult>;
  sendDraft(draftId: string): Promise<GmailSendResult>;
  sendMessage(input: GmailSendInput): Promise<GmailSendResult>;
  getProfile(): Promise<GmailProfile>;
}

export type GmailClientErrorCode =
  | "AUTHENTICATION_FAILED"
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
