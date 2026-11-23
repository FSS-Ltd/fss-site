import Link from "next/link";
import type { CampaignAccountsResult } from "@/lib/growth/dashboard/campaign-accounts";
import { formatGrowthDateTime } from "@/lib/growth/dashboard/formatters";
import styles from "./campaign-overview.module.css";

function evidence(
  value: { observedAt: string; expiresAt: string } | null,
): string {
  return value
    ? `Recorded ${formatGrowthDateTime(value.observedAt)}; expires ${formatGrowthDateTime(value.expiresAt)}`
    : "Unknown";
}
export function CampaignAccountReadiness({
  result,
}: {
  result: CampaignAccountsResult;
}) {
  return (
    <details className={styles.editor}>
      <summary>Account readiness</summary>
      {result.status === "unavailable" ? (
        <p role="status">
          Account information is unavailable. Refresh to try again.
        </p>
      ) : (
        <>
          {result.accounts.length === 0 && (
            <p>No supported account connection is available.</p>
          )}
          {result.accounts.map((account) => (
            <section key={account.id} className={styles.account}>
              <h3>
                {account.provider === "gmail" ? "Gmail" : "Resend"} ·{" "}
                {account.sender}
              </h3>
              <p>
                {account.readiness.status === "ready"
                  ? "Account checks passed for this page load."
                  : `Held: ${account.readiness.reason.replaceAll("_", " ")}`}
              </p>
              <dl>
                <div>
                  <dt>Recorded ramp</dt>
                  <dd>{account.recordedRamp ?? "Unknown"}</dd>
                </div>
                <div>
                  <dt>Limits evidence</dt>
                  <dd>{evidence(account.limitsEvidence)}</dd>
                </div>
                <div>
                  <dt>Health evidence</dt>
                  <dd>{evidence(account.healthEvidence)}</dd>
                </div>
                <div>
                  <dt>Usage observation</dt>
                  <dd>{evidence(account.usageObservation)}</dd>
                </div>
              </dl>
              <p>
                Recorded evidence does not itself establish readiness. Campaign,
                recipient and current account checks still apply.
              </p>
            </section>
          ))}
          {result.resendConfiguration === "unknown" && (
            <p>
              Resend account configuration is unavailable or not associated with
              this founder.
            </p>
          )}
          <p>
            <Link href="/growth/settings">Review Gmail settings</Link>
          </p>
        </>
      )}
    </details>
  );
}
