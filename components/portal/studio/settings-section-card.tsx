import { useEffect, useRef, type FormEvent, type MouseEvent } from "react";
import { Building2, Globe2, MessagesSquare, Activity } from "lucide-react";
import { Notice, PortalButton, PortalCard } from "@/components/portal/ui";
import type {
  ActiveStudioSettings,
  StudioSettingsSection,
} from "@/lib/operations/studio/active-settings-types";
import type { SettingsEditorState } from "./settings-editor-state";
import { SettingsSectionFields } from "./settings-section-fields";
import styles from "./studio-settings.module.css";

const sections = {
  identity: {
    title: "Identity",
    icon: Building2,
    description: "How FSS appears in Studio and new welcome materials.",
  },
  communication: {
    title: "Communication",
    icon: MessagesSquare,
    description:
      "Reply-to and response guidance for new client communications.",
  },
  timezone: {
    title: "Timezone",
    icon: Globe2,
    description: "Studio displays and defaults for newly created clients.",
  },
  delivery: {
    title: "Delivery",
    icon: Activity,
    description: "Operational capacity for the Studio workspace.",
  },
} satisfies Record<
  StudioSettingsSection,
  { title: string; icon: typeof Building2; description: string }
>;

function SectionSummary({
  section,
  active,
}: Readonly<{
  section: StudioSettingsSection;
  active: ActiveStudioSettings;
}>): React.JSX.Element {
  switch (section) {
    case "identity":
      return <p className={styles.value}>{active.displayName}</p>;
    case "communication":
      return (
        <dl className={styles.summary}>
          <div>
            <dt>Response expectation</dt>
            <dd>{active.responseExpectationHours} hours</dd>
          </div>
          <div>
            <dt>Reply-to</dt>
            <dd>{active.replyTo ?? "No reply-to configured"}</dd>
          </div>
        </dl>
      );
    case "timezone":
      return <p className={styles.value}>{active.timezone}</p>;
    case "delivery":
      return (
        <p className={styles.value}>
          {active.deliveryCapacity === "standard"
            ? "Standard"
            : active.deliveryCapacity === "limited"
              ? "Limited"
              : "Priority"}
        </p>
      );
  }
}

type Props = Readonly<{
  section: StudioSettingsSection;
  state: SettingsEditorState;
  approvedReplyTo: readonly string[];
  onEdit: (
    section: StudioSettingsSection,
    event: MouseEvent<HTMLButtonElement>,
  ) => void;
  onChange: (values: Partial<Omit<ActiveStudioSettings, "revision">>) => void;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onReviewConflict: () => void;
}>;

export function SettingsSectionCard({
  section,
  state,
  approvedReplyTo,
  onEdit,
  onChange,
  onClose,
  onSubmit,
  onReviewConflict,
}: Props): React.JSX.Element {
  const { title, icon: Icon, description } = sections[section];
  const editing = state.section === section;
  const pending = state.status === "pending";
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (editing)
      formRef.current
        ?.querySelector<HTMLInputElement | HTMLSelectElement>("input,select")
        ?.focus();
  }, [editing]);
  return (
    <PortalCard
      className={editing ? styles.editingCard : undefined}
      headingId={`settings-${section}`}
    >
      <header className={styles.cardHeader}>
        <div className={styles.cardHeading}>
          <span className={styles.icon}>
            <Icon size={20} aria-hidden="true" />
          </span>
          <h2 id={`settings-${section}`}>{title}</h2>
        </div>
        <PortalButton
          type="button"
          variant="quiet"
          disabled={state.section !== null}
          aria-label={`Edit ${title.toLowerCase()}`}
          aria-expanded={editing}
          aria-controls={`settings-${section}-editor`}
          onClick={(event) => onEdit(section, event)}
        >
          Edit
        </PortalButton>
      </header>
      <SectionSummary section={section} active={state.active} />
      <p className={styles.description}>{description}</p>
      {editing ? (
        <form
          ref={formRef}
          id={`settings-${section}-editor`}
          onSubmit={onSubmit}
          className={styles.editor}
          aria-label={`Edit ${title.toLowerCase()}`}
          aria-busy={pending}
        >
          <SettingsSectionFields
            section={section}
            values={state.values}
            approvedReplyTo={approvedReplyTo}
            pending={pending}
            onChange={onChange}
          />
          {state.status === "error" && state.message ? (
            <Notice tone="error">{state.message}</Notice>
          ) : null}
          {state.conflict ? (
            <Notice tone="warning">
              <p>
                {state.message ??
                  "Review applied settings before trying again."}
              </p>
              <p>Applied revision {state.conflict.revision}</p>
              <SectionSummary section={section} active={state.conflict} />
              <PortalButton
                type="button"
                variant="secondary"
                onClick={onReviewConflict}
              >
                Review and use current revision
              </PortalButton>
            </Notice>
          ) : null}
          {state.message && state.status === "idle" ? (
            <p role="status" className={styles.description}>
              {state.message}
            </p>
          ) : null}
          <div className={styles.actions}>
            <PortalButton
              type="submit"
              loading={pending}
              disabled={state.conflict !== null}
            >
              Save and apply
            </PortalButton>
            <PortalButton
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={onClose}
            >
              Cancel
            </PortalButton>
          </div>
        </form>
      ) : null}
    </PortalCard>
  );
}
