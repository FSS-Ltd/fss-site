export type ViewState<T> =
  | { status: "ready"; data: T }
  | { status: "empty"; reason: string }
  | { status: "error"; message: string; correlationId: string };

export type IntegrationProvider =
  | "database"
  | "gmail"
  | "resend"
  | "codex"
  | "cron";

export type IntegrationStatus =
  | "healthy"
  | "attention"
  | "disconnected"
  | "disabled";

export type IntegrationHealth = {
  provider: IntegrationProvider;
  status: IntegrationStatus;
  checkedAt: string;
  message: string;
};
