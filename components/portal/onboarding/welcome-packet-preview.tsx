"use client";

import Image from "next/image";
import { useState } from "react";
import { PortalButton } from "@/components/portal/ui";
import type { WelcomePackContent } from "@/lib/operations/onboarding/welcome-pack-contract";
import {
  getPacketEdition,
  packetAssets,
} from "@/lib/operations/onboarding/packet-editions";
import styles from "./welcome-packet.module.css";
import { getEmailArtwork } from "@/lib/operations/onboarding/email-artwork";

export function WelcomePacketPreview({
  content,
  clientName = "Your client",
  exactEmailHtml,
}: Readonly<{
  content: WelcomePackContent;
  clientName?: string;
  exactEmailHtml?: string;
}>): React.JSX.Element {
  const [view, setView] = useState<"email" | "packet" | "checklist">("packet");
  const [page, setPage] = useState(0);
  const total = content.guide.length + (content.rendererVersion === 2 ? 1 : 0);
  const section =
    content.guide[Math.max(0, page - (content.rendererVersion === 2 ? 1 : 0))];
  const cover = content.rendererVersion === 2 && page === 0;
  const imageId =
    cover && content.edition
      ? getPacketEdition(content.edition).coverImageId
      : section?.imageId;
  const emailArtwork = getEmailArtwork(
    content.edition ?? "website_build",
    "welcome",
  );
  const emailImage =
    content.emailArtworkVersion === 1
      ? emailArtwork
      : packetAssets[
          getPacketEdition(content.edition ?? "website_build").coverImageId
        ];
  const diagram =
    !cover && (section?.layout === "process" || section?.layout === "timeline");
  const previewCopy = (value: string) =>
    value
      .replaceAll("{{client_name}}", clientName)
      .replaceAll("{{contact_first_name}}", "Alex")
      .replaceAll("{{agreement_goal}}", "a clearer customer experience")
      .replaceAll(
        "{{agreement_scope}}",
        "the services set out in the agreement",
      )
      .replaceAll("{{sender_name}}", "Your FSS team");
  return (
    <section
      aria-label="Welcome packet preview"
      className={styles.previewPanel}
    >
      <h2>Client experience</h2>
      <div className={styles.tabs} aria-label="Preview format">
        {(["email", "packet", "checklist"] as const).map((tab) => (
          <button
            type="button"
            key={tab}
            aria-pressed={view === tab}
            onClick={() => setView(tab)}
          >
            {tab === "email"
              ? "Email"
              : tab === "packet"
                ? "Packet"
                : "Checklist"}
          </button>
        ))}
      </div>
      {view === "email" ? (
        exactEmailHtml ? (
          <iframe
            title="Exact welcome email"
            sandbox=""
            referrerPolicy="no-referrer"
            srcDoc={exactEmailHtml}
            className={styles.exactFrame}
          />
        ) : (
          <article className={styles.email}>
            <div className={styles.emailHeader}>
              <p>FAITHFUL SOFTWARE SOLUTIONS</p>
              <h3>{previewCopy(content.emailSubject)}</h3>
            </div>
            <Image
              alt={emailImage.alt}
              className={styles.emailArtwork}
              src={emailImage.src}
              width={640}
              height={content.emailArtworkVersion === 1 ? 280 : 400}
            />
            <div className={styles.emailBody}>
              {previewCopy(content.emailBody)
                .split(/\n\s*\n/)
                .map((text, i) => (
                  <p key={i}>{text}</p>
                ))}
              <p>
                <strong>Your welcome packet is included.</strong>
              </p>
            </div>
          </article>
        )
      ) : null}
      {view === "packet" ? (
        <>
          <article
            className={`${styles.page} ${cover ? styles.pageCover : ""}`}
            data-layout={section?.layout}
          >
            {imageId && !diagram ? (
              <Image
                alt={packetAssets[imageId].alt}
                className={styles.pageImage}
                src={packetAssets[imageId].src}
                width={640}
                height={400}
              />
            ) : null}
            <div className={styles.pageContent}>
              <p className={styles.pageEyebrow}>
                {cover
                  ? "FAITHFUL SOFTWARE SOLUTIONS"
                  : `YOUR WELCOME · ${String(page + 1).padStart(2, "0")}`}
              </p>
              <h3>
                {cover
                  ? "Good work starts here."
                  : previewCopy(section?.title ?? "Welcome")}
              </h3>
              {cover ? (
                <>
                  <p>A welcome packet prepared for</p>
                  <p>
                    <strong>{clientName}</strong>
                  </p>
                  <p>Your project. Your priorities. Our next steps together.</p>
                </>
              ) : diagram ? (
                <ol className={styles.process}>
                  {section?.paragraphs.map((text, i) => (
                    <li key={i}>{previewCopy(text)}</li>
                  ))}
                </ol>
              ) : (
                section?.paragraphs.map((text, i) => (
                  <p key={i}>{previewCopy(text)}</p>
                ))
              )}
            </div>
            <footer className={styles.pageFooter}>
              <span>FSS · {clientName}</span>
              <span>
                {page + 1} / {total}
              </span>
            </footer>
          </article>
          <div className={styles.pageNav}>
            <PortalButton
              variant="secondary"
              type="button"
              disabled={page === 0}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
            >
              Previous
            </PortalButton>
            <span aria-live="polite">
              {page + 1} of {total}
            </span>
            <PortalButton
              variant="secondary"
              type="button"
              disabled={page >= total - 1}
              onClick={() => setPage((p) => Math.min(total - 1, p + 1))}
            >
              Next
            </PortalButton>
          </div>
        </>
      ) : null}
      {view === "checklist" ? (
        <ol>
          {content.tasks.map((task) => (
            <li key={task.id}>
              <strong>{task.title}</strong>
              <p>{task.instructions}</p>
              <p className={styles.muted}>
                {task.required ? "Required" : "Optional"} ·{" "}
                {task.ownerRole.replaceAll("_", " ")}
              </p>
            </li>
          ))}
        </ol>
      ) : null}
      <p className={styles.muted}>
        Draft preview. Review the generated document before approval.
      </p>
    </section>
  );
}
