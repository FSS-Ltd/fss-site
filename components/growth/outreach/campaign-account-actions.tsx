"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type {
  CampaignAccount,
  CampaignAccountsResult,
} from "@/lib/growth/dashboard/campaign-accounts";
import styles from "./campaign-overview.module.css";

type Action =
  | "activate"
  | "halt"
  | "approve_ramp"
  | "reduce_ramp"
  | "configure";
type Intent = {
  action: Action;
  provider: "gmail" | "resend";
  expectedVersion: number;
  ramp?: 25 | 50 | 100 | 150;
  reason?: string;
};
function description(intent: Intent): string {
  if (intent.action === "configure")
    return "Save the current server-defined Resend binding. This pauses the account and resets its health review and usage observation.";
  if (intent.action === "activate")
    return "Activate this account if its current prerequisites still pass. Campaigns remain separately controlled.";
  if (intent.action === "halt")
    return "Halt this account for outreach until it is reviewed and activated again.";
  return `${intent.action === "approve_ramp" ? "Advance" : "Reduce"} the recorded daily account ramp to ${intent.ramp}. Current policy and recipient checks still apply.`;
}
function AccountActionForm({
  provider,
  version,
  children,
}: {
  provider: "gmail" | "resend";
  version: number;
  children: (
    begin: (
      event: React.MouseEvent<HTMLButtonElement>,
      action: Action,
      extra?: { ramp?: 25 | 50 | 100 | 150; reason?: string },
    ) => void,
    disabled: boolean,
  ) => React.ReactNode;
}) {
  const router = useRouter();
  const [intent, setIntent] = useState<Intent | null>(null);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [acceptedVersion, setAcceptedVersion] = useState<number | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [trigger, setTrigger] = useState<HTMLButtonElement | null>(null);
  const feedback = useRef<HTMLParagraphElement>(null);
  const retry = useRef<{ payload: string; id: string } | null>(null);
  useEffect(() => {
    if (message) feedback.current?.focus();
  }, [message]);
  const waiting = acceptedVersion === version;
  function begin(
    event: React.MouseEvent<HTMLButtonElement>,
    action: Action,
    extra: { ramp?: 25 | 50 | 100 | 150; reason?: string } = {},
  ) {
    setTrigger(event.currentTarget);
    setIntent({ action, provider, expectedVersion: version, ...extra });
    setMessage("");
    setSuccess(false);
  }
  async function submit() {
    if (!intent || intent.expectedVersion !== version) return;
    const payload = JSON.stringify(intent);
    if (retry.current?.payload !== payload)
      retry.current = { payload, id: crypto.randomUUID() };
    setPending(true);
    setMessage("");
    setSessionExpired(false);
    try {
      const response = await fetch("/api/growth/outreach-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...intent, requestId: retry.current.id }),
      });
      if (!response.ok) {
        let code = "";
        try {
          const result: unknown = await response.json();
          if (
            result &&
            typeof result === "object" &&
            "code" in result &&
            typeof result.code === "string"
          )
            code = result.code;
        } catch {
          /* No safe error detail. */
        }
        const reasons: Record<string, string> = {
          account_version_changed: "The account changed.",
          account_authority_changed: "The account grant changed.",
          account_identity_unknown: "The account identity is unavailable.",
          runtime_binding_unknown: "The server binding is unavailable.",
          limits_unknown: "Limits evidence is missing or stale.",
          health_unknown: "Health evidence is missing or stale.",
          usage_unknown: "Usage evidence is missing or stale.",
          visibility_unknown:
            "Mailbox visibility evidence is missing or stale.",
          quota_exhausted: "The observed account allowance is exhausted.",
          health_review_reused: "A newer health review is required.",
          invalid_ramp_step: "The requested ramp step is no longer available.",
          invalid_ramp_reduction: "Choose a lower ramp than the current value.",
          account_not_activated:
            "Activate the account before advancing the ramp.",
          account_not_active: "The account is not active.",
          identity_or_grant_unknown:
            "The Gmail identity or grant needs review.",
          identity_or_configuration_unknown:
            "The Resend identity or configuration needs review.",
          identity_or_usage_unknown:
            "The Resend identity or usage evidence needs review.",
          request_conflict: "This request conflicts with a previous action.",
        };
        setSessionExpired(response.status === 401);
        setMessage(
          response.status === 401
            ? "Your session expired. Sign in again; your action is retained."
            : `${Object.hasOwn(reasons, code) ? reasons[code] : "The account action could not be completed."} Your action is retained; review the account before retrying.`,
        );
        return;
      }
      retry.current = null;
      setAcceptedVersion(intent.expectedVersion);
      setSuccess(true);
      setIntent(null);
      setMessage(
        "Account action recorded. Refreshing the current account state.",
      );
      router.refresh();
    } catch {
      setMessage(
        "The account action could not be completed. Your action is retained; try again.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <div className={styles.accountActions}>
      {children(begin, pending || intent !== null || waiting)}
      {intent && (
        <div
          className={styles.confirm}
          role="group"
          aria-label="Confirm account action"
        >
          <p>{description(intent)}</p>
          {intent.expectedVersion !== version && (
            <p role="alert">
              The account changed. Cancel and review the current state before
              continuing.
            </p>
          )}
          <button
            autoFocus
            type="button"
            disabled={pending || intent.expectedVersion !== version}
            onClick={submit}
          >
            {pending ? "Saving…" : "Confirm action"}
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setIntent(null);
              requestAnimationFrame(() => trigger?.focus());
            }}
          >
            Cancel
          </button>
        </div>
      )}
      {message && (
        <p ref={feedback} tabIndex={-1} role={success ? "status" : "alert"}>
          {message}{" "}
          {sessionExpired && (
            <a href="/growth/login" target="_blank" rel="noreferrer">
              Sign in in a new tab
            </a>
          )}
        </p>
      )}
    </div>
  );
}
export function CampaignAccountActions({
  account,
}: {
  account: CampaignAccount;
}) {
  const [reason, setReason] = useState("");
  const [reduction, setReduction] = useState("");
  const control = account.control;
  if (!control)
    return (
      <p>
        Account controls are unavailable until a control record exists. Limits
        and health evidence entry is not available here.
      </p>
    );
  return (
    <details className={styles.editor}>
      <summary>Account controls</summary>
      <p>
        State: {control.state} · version {control.version}. Account activation
        does not activate a campaign.
      </p>
      <AccountActionForm provider={account.provider} version={control.version}>
        {(begin, disabled) => (
          <>
            {control.state !== "active" &&
              (control.prerequisites.status === "ready" ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(event) => begin(event, "activate")}
                >
                  Activate account
                </button>
              ) : (
                <p>
                  Activation held:{" "}
                  {control.prerequisites.reason.replaceAll("_", " ")}.
                </p>
              ))}
            {control.advance &&
              (control.advance.readiness.status === "ready" ? (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={(event) =>
                    begin(event, "approve_ramp", {
                      ramp: control.advance?.next,
                    })
                  }
                >
                  Approve ramp to {control.advance.next}
                </button>
              ) : (
                <p>
                  Ramp advance held:{" "}
                  {control.advance.readiness.reason.replaceAll("_", " ")}.
                </p>
              ))}
            {control.ramp > 25 && (
              <div className={styles.accountInput}>
                <label>
                  Reduce ramp to
                  <select
                    value={reduction}
                    disabled={disabled}
                    onChange={(event) => setReduction(event.target.value)}
                  >
                    <option value="">Choose a lower ramp</option>
                    {([25, 50, 100] as const)
                      .filter((value) => value < control.ramp)
                      .map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={disabled || !reduction}
                  onClick={(event) => {
                    const value = Number(reduction);
                    if (value === 25 || value === 50 || value === 100)
                      begin(event, "reduce_ramp", { ramp: value });
                  }}
                >
                  Reduce ramp
                </button>
              </div>
            )}
            {control.state !== "halted" && (
              <div className={styles.accountInput}>
                <label>
                  Reason for halt
                  <input
                    value={reason}
                    maxLength={500}
                    disabled={disabled}
                    onChange={(event) => setReason(event.target.value)}
                  />
                </label>
                <button
                  type="button"
                  disabled={disabled || !reason.trim()}
                  onClick={(event) =>
                    begin(event, "halt", { reason: reason.trim() })
                  }
                >
                  Halt account
                </button>
              </div>
            )}
          </>
        )}
      </AccountActionForm>
      <p>Limits and health evidence entry is not available here.</p>
    </details>
  );
}
export function ResendSetupAction({
  setup,
}: {
  setup: Extract<CampaignAccountsResult, { status: "ready" }>["resendSetup"];
}) {
  if (setup.status === "held")
    return (
      <p>Resend setup unavailable: {setup.reason.replaceAll("_", " ")}.</p>
    );
  return (
    <div className={styles.accountInput}>
      <p>
        Server-defined Resend sender: {setup.sender}. Configuration does not
        activate sending.
      </p>
      <AccountActionForm provider="resend" version={setup.expectedVersion}>
        {(begin, disabled) => (
          <button
            type="button"
            disabled={disabled}
            onClick={(event) => begin(event, "configure")}
          >
            Review Resend configuration
          </button>
        )}
      </AccountActionForm>
    </div>
  );
}
