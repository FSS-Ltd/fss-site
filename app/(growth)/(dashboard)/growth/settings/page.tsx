import Link from "next/link";

import { AutomationControls } from "@/components/growth/settings/automation-controls";
import { GmailOAuthNotice } from "@/components/growth/settings/gmail-oauth-notice";
import { IntegrationHealth } from "@/components/growth/settings/integration-health";
import styles from "@/components/growth/settings/settings.module.css";
import { getSettings } from "@/lib/growth/dashboard/settings";

type SettingsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function SettingsPage({
  searchParams,
}: SettingsPageProps) {
  const params = await searchParams;
  const result = await getSettings();

  if (result.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{result.message}</p>
        <p className={styles.errorCorrelation}>
          Reference: {result.correlationId}
        </p>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.heading}>Settings</h1>
        </div>
      </div>

      <GmailOAuthNotice status={params.gmail} />

      <IntegrationHealth data={result.data} />
      <AutomationControls automation={result.data.automation} />
      <p className={styles.privacyNote}>
        Review how Growth OS handles business contact and Gmail data in the{" "}
        <Link href="/privacy">privacy notice</Link>.
      </p>
    </div>
  );
}
