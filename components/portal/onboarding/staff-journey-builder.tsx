"use client";
import {
  PortalButton,
  PortalCard,
  PortalSelect,
  StatusBadge,
} from "@/components/portal/ui";
import { journeyBuilderStages } from "@/lib/operations/onboarding/builder-stage";
import type { JourneyComposerProps } from "./journey-composer-types";
import { useJourneyComposer } from "./use-journey-composer";
import {
  JourneySetupStage,
  JourneyAccessStage,
  JourneyScheduleStage,
} from "./journey-preparation-stages";
import { JourneyContentStage } from "./journey-content-stage";
import { JourneyActivateStage } from "./journey-review-stage";
import styles from "./welcome-packet.module.css";
const stageNames = {
  setup: "Setup",
  content: "Content",
  access: "Access",
  schedule: "Schedule",
  activate: "Review",
} as const;
export function StaffJourneyBuilder(
  props: JourneyComposerProps,
): React.JSX.Element {
  const composer = useJourneyComposer(props);
  const { stage, packet, pending } = composer;
  const stageIndex = journeyBuilderStages.indexOf(stage);
  return (
    <PortalCard
      title="Prepare a warm welcome"
      description="Preflight starts with the client facts. Choose a finished packet, personalise it and review the exact materials before approval."
    >
      <div className={styles.toolbar}>
        <StatusBadge status={composer.dirty ? "warning" : "neutral"}>
          {composer.dirty
            ? "Unsaved changes"
            : composer.version
              ? `Saved draft · v${composer.version}`
              : "New journey"}
        </StatusBadge>
        {props.drafts?.length ? (
          <PortalSelect
            label="Restore saved draft"
            value={composer.draftId}
            disabled={pending}
            onChange={(e) => {
              if (!e.target.value) {
                if (
                  !composer.dirty ||
                  window.confirm(
                    "Discard unsaved edits and start a new journey?",
                  )
                )
                  composer.newDraft();
                return;
              }
              const draft = props.drafts?.find((d) => d.id === e.target.value);
              if (
                draft &&
                (!composer.dirty ||
                  window.confirm(
                    "Discard unsaved edits and restore this draft?",
                  ))
              )
                composer.restore(draft);
            }}
          >
            <option value="">New draft</option>
            {props.drafts.map((d) => (
              <option key={d.id} value={d.id}>
                Saved {stageNames[d.stage]} · version {d.version}
              </option>
            ))}
          </PortalSelect>
        ) : null}
      </div>
      <nav className={styles.stages} aria-label="Welcome preparation stages">
        {journeyBuilderStages.map((item, index) => (
          <button
            type="button"
            key={item}
            aria-current={item === stage ? "step" : undefined}
            disabled={pending}
            onClick={() => composer.setStage(item)}
          >
            <span>{index + 1}</span>
            {stageNames[item]}
          </button>
        ))}
      </nav>
      {stage === "setup" ? (
        <JourneySetupStage props={props} composer={composer} />
      ) : null}
      {stage === "content" ? (
        <JourneyContentStage props={props} composer={composer} />
      ) : null}
      {stage === "access" ? (
        <JourneyAccessStage props={props} composer={composer} />
      ) : null}
      {stage === "schedule" ? (
        <JourneyScheduleStage props={props} composer={composer} />
      ) : null}
      {stage === "activate" ? (
        <JourneyActivateStage props={props} composer={composer} />
      ) : null}
      <div className={styles.toolbar}>
        <PortalButton
          type="button"
          variant="secondary"
          disabled={pending || !packet}
          loading={pending}
          onClick={() => composer.save()}
        >
          Save journey draft
        </PortalButton>
        <div className={styles.actions}>
          {stageIndex > 0 ? (
            <PortalButton
              type="button"
              variant="secondary"
              disabled={pending}
              onClick={() =>
                composer.setStage(
                  journeyBuilderStages[stageIndex - 1] ?? "setup",
                )
              }
            >
              Back
            </PortalButton>
          ) : null}
          {stageIndex < 4 ? (
            <PortalButton
              type="button"
              disabled={pending}
              onClick={() =>
                composer.setStage(
                  journeyBuilderStages[stageIndex + 1] ?? "activate",
                )
              }
            >
              Continue to{" "}
              {stageNames[journeyBuilderStages[stageIndex + 1] ?? "activate"]}
            </PortalButton>
          ) : null}
        </div>
      </div>
      {composer.message ? <p role="status">{composer.message}</p> : null}
    </PortalCard>
  );
}
