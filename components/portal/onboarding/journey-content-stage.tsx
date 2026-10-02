"use client";
import { useState } from "react";
import { Notice, PortalButton } from "@/components/portal/ui";
import type { JourneyComposerProps } from "./journey-composer-types";
import type { useJourneyComposer } from "./use-journey-composer";
import { WelcomePacketPreview } from "./welcome-packet-preview";
import { WelcomePackLibrary } from "./welcome-pack-library";
import { WelcomePackContentEditor } from "./welcome-pack-content-editor";
import styles from "./welcome-packet.module.css";
export function JourneyContentStage({
  props,
  composer,
}: Readonly<{
  props: JourneyComposerProps;
  composer: ReturnType<typeof useJourneyComposer>;
}>): React.JSX.Element {
  const { packet, pending } = composer;
  const [mobileView, setMobileView] = useState<"edit" | "preview">("edit");
  const [choosing, setChoosing] = useState(false);
  if (!packet || choosing)
    return (
      <>
        <WelcomePackLibrary
          packs={props.welcomePacks}
          actionLabel="Use packet"
          disabled={pending}
          onChoose={async (pack) => {
            await composer.choosePack(pack);
            setChoosing(false);
          }}
        />
        {!props.welcomePacks.length ? (
          <Notice tone="info">
            Publish an edition in Welcome templates before selecting its packet
            here.
          </Notice>
        ) : null}
        {packet ? (
          <PortalButton
            variant="secondary"
            type="button"
            onClick={() => setChoosing(false)}
          >
            Return to current packet
          </PortalButton>
        ) : null}
      </>
    );
  return (
    <>
      <div className={styles.toolbar}>
        <h3>Personalised for {props.organisationName}</h3>
        <PortalButton
          variant="secondary"
          type="button"
          disabled={pending}
          onClick={() => {
            if (
              !composer.dirty ||
              window.confirm(
                "Replace unsaved packet edits with another published edition?",
              )
            )
              setChoosing(true);
          }}
        >
          Change packet
        </PortalButton>
      </div>
      <div className={styles.mobileSwitcher} aria-label="Content view">
        <button
          type="button"
          aria-pressed={mobileView === "edit"}
          onClick={() => setMobileView("edit")}
        >
          Edit
        </button>
        <button
          type="button"
          aria-pressed={mobileView === "preview"}
          onClick={() => setMobileView("preview")}
        >
          Preview
        </button>
      </div>
      <div className={styles.split} data-mobile-view={mobileView}>
        <div className={styles.editPane}>
          <WelcomePackContentEditor
            content={packet}
            onChange={composer.changePacket}
            disabled={pending}
            editChecklist={false}
          />
        </div>
        <div className={styles.previewPane}>
          <WelcomePacketPreview
            content={packet}
            clientName={props.organisationName}
          />
        </div>
      </div>
    </>
  );
}
