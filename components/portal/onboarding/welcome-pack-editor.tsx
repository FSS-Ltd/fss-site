"use client";
import { useState } from "react";
import { BookOpen, ArrowLeft } from "lucide-react";
import {
  Notice,
  PortalButton,
  PortalField,
  StatusBadge,
} from "@/components/portal/ui";
import { createDesignedWelcomePack } from "@/lib/operations/onboarding/packet-editions";
import type { WelcomePack } from "@/lib/operations/onboarding/welcome-pack-contract";
import { WelcomePackLibrary } from "./welcome-pack-library";
import { WelcomePackContentEditor } from "./welcome-pack-content-editor";
import { WelcomePacketPreview } from "./welcome-packet-preview";
import { useWelcomePackEditor } from "./use-welcome-pack-editor";
import styles from "./welcome-packet.module.css";

function PacketWorkspace({
  pack,
  onBack,
}: Readonly<{
  pack: WelcomePack;
  onBack: (saved: WelcomePack) => void;
}>): React.JSX.Element {
  const editor = useWelcomePackEditor(pack);
  const [mobile, setMobile] = useState<"edit" | "preview">("edit");
  return (
    <section
      className={styles.workspace}
      aria-label="Shared welcome pack editor"
    >
      <div className={styles.toolbar}>
        <div>
          <h2>{pack.title}</h2>
          <p>
            Draft v{editor.revision} ·{" "}
            {pack.publishedVersion
              ? `Published v${pack.publishedVersion}`
              : "Ready for your review"}
          </p>
        </div>
        <PortalButton
          type="button"
          variant="secondary"
          disabled={editor.pending}
          onClick={() => {
            if (
              !editor.dirty ||
              window.confirm(
                "Discard unsaved packet edits and return to the library?",
              )
            )
              onBack(editor.savedPack);
          }}
        >
          <ArrowLeft size={16} aria-hidden="true" />
          Packet library
        </PortalButton>
      </div>
      {JSON.stringify(editor.content) !==
      JSON.stringify(createDesignedWelcomePack(pack.id)) ? (
        <Notice tone="info">
          The current designed edition is available for this service. Loading it
          replaces this draft&apos;s copy and checklist. Published versions
          remain available.
          <PortalButton
            type="button"
            variant="secondary"
            onClick={() => {
              if (
                window.confirm(
                  "Replace this packet draft and checklist with the current designed edition?",
                )
              )
                editor.update(createDesignedWelcomePack(pack.id));
            }}
          >
            Load designed edition
          </PortalButton>
        </Notice>
      ) : null}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void editor.send();
        }}
        aria-busy={editor.pending}
        className={styles.workspace}
      >
        <div className={`${styles.tabs} ${styles.mobileView}`}>
          <button
            type="button"
            aria-pressed={mobile === "edit"}
            onClick={() => setMobile("edit")}
          >
            Edit
          </button>
          <button
            type="button"
            aria-pressed={mobile === "preview"}
            onClick={() => setMobile("preview")}
          >
            Preview
          </button>
        </div>
        <div className={styles.split}>
          <div
            className={mobile === "preview" ? styles.mobileHidden : undefined}
          >
            <WelcomePackContentEditor
              content={editor.content}
              onChange={editor.update}
              disabled={editor.pending}
            />
          </div>
          <div className={mobile === "edit" ? styles.mobileHidden : undefined}>
            <WelcomePacketPreview
              content={editor.content}
              clientName="Northstar Studio"
            />
          </div>
        </div>
        <div className={styles.editor}>
          <PortalField label="Review reference" required>
            <input
              value={editor.reviewReference}
              onChange={(e) => editor.setReviewReference(e.target.value)}
              maxLength={200}
              required
              disabled={editor.pending}
            />
          </PortalField>
          <div className={styles.actions}>
            <PortalButton type="submit" loading={editor.pending}>
              Save draft
            </PortalButton>
            <PortalButton
              type="button"
              variant="secondary"
              disabled={!editor.savedRevision || editor.pending}
              onClick={() => void editor.send(true)}
            >
              Publish reviewed version
            </PortalButton>
            <StatusBadge status={editor.dirty ? "warning" : "neutral"}>
              {editor.dirty ? "Unsaved changes" : "Draft saved"}
            </StatusBadge>
          </div>
          {editor.message ? <p role="status">{editor.message}</p> : null}
          <p className={styles.muted}>
            Publishing makes an immutable edition available to future journeys.
            Existing client welcomes retain their approved content.
          </p>
        </div>
      </form>
    </section>
  );
}
export function WelcomePackEditor({
  packs,
}: Readonly<{ packs: readonly WelcomePack[] }>): React.JSX.Element {
  const [library, setLibrary] = useState(packs);
  const [selected, setSelected] = useState<WelcomePack | null>(null);
  if (selected)
    return (
      <PacketWorkspace
        key={selected.id}
        pack={selected}
        onBack={(saved) => {
          setLibrary((current) =>
            current.map((item) => (item.id === saved.id ? saved : item)),
          );
          setSelected(null);
        }}
      />
    );
  return (
    <section className={styles.workspace} aria-label="Welcome packet library">
      <div className={styles.toolbar}>
        <div>
          <h2>A considered welcome, ready to personalise.</h2>
          <p>
            Choose a service edition to review its email, publication, and
            client checklist.
          </p>
        </div>
        <span className={styles.progress}>
          <BookOpen size={18} aria-hidden="true" />
          Three service editions
        </span>
      </div>
      {library.length ? (
        <WelcomePackLibrary packs={library} onChoose={setSelected} />
      ) : (
        <Notice tone="info">
          No welcome packets are available. Your administrator can prepare the
          three FSS editions.
        </Notice>
      )}
    </section>
  );
}
