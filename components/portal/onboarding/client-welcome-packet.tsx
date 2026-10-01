import Image from "next/image";
import { Download } from "lucide-react";
import { PortalActionLink, PortalCard } from "@/components/portal/ui";
import {
  getPacketEdition,
  packetAssets,
} from "@/lib/operations/onboarding/packet-editions";
import type { ClientWelcomePacket } from "@/lib/operations/onboarding/client-packet-contract";
import styles from "./client-welcome-packet.module.css";

export function ClientWelcomePacketCard({
  packet,
  organisationId,
}: Readonly<{
  packet: ClientWelcomePacket;
  organisationId: string;
}>): React.JSX.Element {
  const edition = packet.edition ? getPacketEdition(packet.edition) : null;
  const cover = edition ? packetAssets[edition.coverImageId] : null;
  return (
    <PortalCard
      title="Your welcome packet"
      description="Your approved guide to the project, responsibilities and next steps."
    >
      <div className={styles.cover}>
        {cover ? (
          <div className={styles.artwork}>
            <Image
              src={cover.src}
              alt={cover.alt}
              fill
              sizes="(max-width: 680px) 100vw, 240px"
            />
          </div>
        ) : null}
        <div className={styles.coverCopy}>
          <h3>{packet.title}</h3>
          {edition ? (
            <p>
              {edition.title} · {packet.pages.length + 1} pages
            </p>
          ) : null}
          <p>
            Prepared by {packet.senderName}
            <br />
            {packet.organisationName}
          </p>
          <PortalActionLink
            href={`/api/portal/organisations/${encodeURIComponent(organisationId)}/onboarding/packet/${packet.approvalId}/download`}
            variant="secondary"
          >
            <Download aria-hidden="true" size={16} />
            Download PDF
          </PortalActionLink>
        </div>
      </div>
      <details className={styles.reader}>
        <summary>Read your welcome packet</summary>
        <article aria-label={packet.title} className={styles.pages}>
          {packet.pages.map((page, index) => {
            const asset = page.imageId ? packetAssets[page.imageId] : null;
            const diagram =
              page.layout === "process" || page.layout === "timeline";
            return (
              <section
                key={page.sectionId ?? index}
                aria-labelledby={`client-packet-section-${index}`}
              >
                <p className={styles.sectionNumber}>
                  Section {String(index + 1).padStart(2, "0")}
                </p>
                <h4 id={`client-packet-section-${index}`}>{page.title}</h4>
                {asset ? (
                  <div className={styles.sectionArtwork}>
                    <Image
                      src={asset.src}
                      alt={asset.alt}
                      fill
                      sizes="(max-width: 680px) 100vw, 720px"
                    />
                  </div>
                ) : null}
                {diagram ? (
                  <ol>
                    {page.paragraphs.map((paragraph, paragraphIndex) => (
                      <li key={paragraphIndex}>{paragraph}</li>
                    ))}
                  </ol>
                ) : (
                  page.paragraphs.map((paragraph, paragraphIndex) => (
                    <p key={paragraphIndex}>{paragraph}</p>
                  ))
                )}
              </section>
            );
          })}
        </article>
      </details>
    </PortalCard>
  );
}
