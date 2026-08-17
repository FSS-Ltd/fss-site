export type GmailProfile = {
  emailAddress: string;
  historyId: string;
};

export interface GmailClient {
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
