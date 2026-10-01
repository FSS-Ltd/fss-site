"use client";

import {
  Notice,
  PageHeader,
  PortalButton,
  PortalCard,
  StatusBadge,
} from "@/components/portal/ui";
import type { StudioSettingsSection } from "@/lib/operations/studio/active-settings-types";
import type { StudioSettings as StudioSettingsModel } from "@/lib/operations/studio/settings";
import { SettingsSectionCard } from "./settings-section-card";
import { useSettingsEditor } from "./use-settings-editor";
import styles from "./studio-settings.module.css";

const sectionOrder: readonly StudioSettingsSection[] = [
  "identity",
  "communication",
  "timezone",
  "delivery",
];

export function StudioSettings({
  settings,
}: Readonly<{ settings: StudioSettingsModel }>): React.JSX.Element {
  const {
    state,
    discardRequested,
    keepEditing,
    discard,
    edit,
    change,
    close,
    submit,
    reviewConflict,
  } = useSettingsEditor(settings.active);

  return (
    <section className={styles.page} aria-labelledby="studio-settings-heading">
      <PageHeader
        titleId="studio-settings-heading"
        title="Studio settings"
        eyebrow="FSS Studio · Operations station"
        description="Review the applied client experience, then edit the section you need."
        action={
          <StatusBadge status="neutral">
            {state.active.revision
              ? `Applied revision ${state.active.revision}`
              : "Default settings"}
          </StatusBadge>
        }
      />
      <Notice tone="info">
        Applying settings affects new welcome materials and Studio defaults.
        Existing agreements and approved content remain frozen.
      </Notice>
      {state.section ? (
        <p className={styles.description}>
          Finish this section before editing another. Your changes apply only
          when you choose Save and apply.
        </p>
      ) : null}
      {discardRequested ? (
        <Notice
          tone="warning"
          action={
            <div className={styles.actions}>
              <PortalButton
                type="button"
                variant="secondary"
                autoFocus
                onClick={keepEditing}
              >
                Keep editing
              </PortalButton>
              <PortalButton
                type="button"
                variant="destructive"
                onClick={discard}
              >
                Discard edits
              </PortalButton>
            </div>
          }
        >
          Discard your unapplied settings edits?
        </Notice>
      ) : null}
      {state.status === "success" ? (
        <Notice tone="success">{state.message}</Notice>
      ) : null}
      <div className={styles.grid}>
        {sectionOrder.map((section) => (
          <SettingsSectionCard
            key={section}
            section={section}
            state={state}
            approvedReplyTo={settings.approvedReplyTo}
            onEdit={edit}
            onChange={change}
            onClose={close}
            onSubmit={submit}
            onReviewConflict={reviewConflict}
          />
        ))}
      </div>
      <PortalCard
        title="Configuration availability"
        headingId="settings-integrations"
        description="Deployment configuration only. These indicators do not report live provider health. Credentials and feature flags remain deployment-owned."
      >
        <ul className={styles.integrations}>
          {settings.integrationConfiguration.map((integration) => (
            <li className={styles.integration} key={integration.name}>
              <div>
                <h3>{integration.name}</h3>
                <p>{integration.detail}</p>
              </div>
              <StatusBadge
                status={integration.available ? "success" : "warning"}
              >
                {integration.available
                  ? "Available in configuration"
                  : "Not enabled in configuration"}
              </StatusBadge>
            </li>
          ))}
        </ul>
      </PortalCard>
      {settings.draft ? (
        <p className={styles.description}>
          Historical draft revision {settings.draft.revision} is retained
          separately. It has not been applied.
        </p>
      ) : null}
    </section>
  );
}
