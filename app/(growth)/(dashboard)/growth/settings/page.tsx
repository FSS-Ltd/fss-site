import { AutomationControls } from "@/components/growth/settings/automation-controls";
import { IntegrationHealth } from "@/components/growth/settings/integration-health";
import styles from "@/components/growth/settings/settings.module.css";
import { getSettings } from "@/lib/growth/dashboard/settings";

export default async function SettingsPage() {
  const result = await getSettings();

  if (result.status === "error") {
    return (
      <div className={styles.errorState} role="alert">
        <p>{result.message}</p>
        <p className={styles.errorCorrelation}>Reference: {result.correlationId}</p>
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

      <IntegrationHealth data={result.data} />
      <AutomationControls automation={result.data.automation} />
    </div>
  );
}
