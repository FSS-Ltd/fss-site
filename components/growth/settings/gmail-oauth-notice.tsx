import styles from "./settings.module.css";

const GMAIL_OAUTH_NOTICES = {
  connected: {
    message: "Gmail connected successfully.",
    tone: "success",
  },
  disconnected: {
    message: "Gmail disconnected.",
    tone: "success",
  },
  revocation_unconfirmed: {
    message:
      "Gmail disconnected locally, but Google could not confirm token revocation. Review access in your Google Account.",
    tone: "error",
  },
  state_error: {
    message:
      "The Gmail connection expired or could not be verified. Try connecting again.",
    tone: "error",
  },
  provider_error: {
    message:
      "Google did not return the access Growth OS requires. Try connecting again.",
    tone: "error",
  },
  callback_error: {
    message:
      "Google did not return an authorisation code. Try connecting again.",
    tone: "error",
  },
  missing_refresh_token: {
    message:
      "Google did not return offline access. Reconnect Gmail and approve access.",
    tone: "error",
  },
  identity_error: {
    message:
      "The connected Google account does not match the configured founder account.",
    tone: "error",
  },
  unexpected_error: {
    message: "Gmail could not be connected. Try again.",
    tone: "error",
  },
} as const;

type GmailOAuthStatus = keyof typeof GMAIL_OAUTH_NOTICES;

export function GmailOAuthNotice({
  status,
}: {
  status: string | string[] | undefined;
}) {
  if (typeof status !== "string" || !(status in GMAIL_OAUTH_NOTICES)) {
    return null;
  }

  const notice = GMAIL_OAUTH_NOTICES[status as GmailOAuthStatus];
  return (
    <p
      className={styles.oauthNotice}
      data-tone={notice.tone}
      role={notice.tone === "error" ? "alert" : "status"}
    >
      {notice.message}
    </p>
  );
}
