"use client";
import { Notice, PortalButton } from "@/components/portal/ui";
import type { JourneyComposerProps } from "./journey-composer-types";
import type { useJourneyComposer } from "./use-journey-composer";
import styles from "./welcome-packet.module.css";
type StageProps = Readonly<{
  props: JourneyComposerProps;
  composer: ReturnType<typeof useJourneyComposer>;
}>;
import { JourneyPreview } from "@/components/operations/onboarding/journey-preview";
export function JourneyActivateStage({
  props,
  composer,
}: StageProps): React.JSX.Element {
  const { packet, pending } = composer;
  const missing = [
    !composer.agreement && "Select a current agreement",
    !composer.contact && "Select a contact",
    !packet && "Use a published packet",
    (!composer.scopeSummary || !composer.responsibilitiesSummary) &&
      "Review both agreement callouts",
    !props.billing && "Configure billing",
    !props.settings?.replyTo && "Apply an approved reply-to in Settings",
    !composer.obligationKey && "Select the first agreed invoice",
  ].filter(Boolean);
  return (
    <>
      {packet ? (
        <div className={styles.facts}>
          <h3>Agreement callouts for final review</h3>
          <p>
            Proposed scope in brief:{" "}
            {composer.scopeSummary || "Add a summary in Content."}
          </p>
          <p>
            Your part in the proposed work:{" "}
            {composer.responsibilitiesSummary || "Add a summary in Content."}
          </p>
          <details>
            <summary>Compare with the agreement wording</summary>
            <p>{composer.agreement?.draft.scope}</p>
            <p>{composer.agreement?.draft.responsibilities}</p>
          </details>
        </div>
      ) : null}
      <div className={styles.facts}>
        <h3>Ready for exact review</h3>
        <p>
          {composer.contact?.name} · {composer.contact?.email}
        </p>
        <p>{composer.agreement?.draft.title}</p>
        {missing.length ? (
          <Notice tone="warning">
            <ul>
              {missing.map((item) => (
                <li key={String(item)}>{item}</li>
              ))}
            </ul>
          </Notice>
        ) : (
          <p>Recipient, agreement, packet and first invoice are selected.</p>
        )}
      </div>
      <JourneyPreview
        organisationId={props.organisationId}
        organisationName={props.organisationName ?? "Client"}
        agreements={props.agreementRecords ?? []}
        contacts={[...props.contacts]}
        approvals={props.approvals ?? []}
        journeys={[]}
        billing={props.billing}
        commandEndpoint={props.commandEndpoint}
        renderWelcomePreparation={(prepare, busy) => (
          <PortalButton
            type="button"
            disabled={busy || pending || Boolean(missing.length)}
            loading={busy || pending}
            onClick={() => composer.prepare(prepare)}
          >
            Generate exact email and PDF preview
          </PortalButton>
        )}
      />
    </>
  );
}
