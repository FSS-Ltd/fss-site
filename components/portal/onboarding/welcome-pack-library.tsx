"use client";

import Image from "next/image";
import { BookOpen, ArrowRight } from "lucide-react";
import { PortalButton, StatusBadge } from "@/components/portal/ui";
import type {
  WelcomePack,
  WelcomePackId,
} from "@/lib/operations/onboarding/welcome-pack-contract";
import {
  getPacketEdition,
  packetAssets,
} from "@/lib/operations/onboarding/packet-editions";
import styles from "./welcome-packet.module.css";

const descriptions: Record<WelcomePackId, string> = {
  website_build:
    "A considered start to your website, from the first conversation to launch.",
  website_seo:
    "A clear website plan, search priorities, and a rhythm for ongoing improvement.",
  systems_portal:
    "People, workflows, and decisions brought together in a purposeful system.",
};
const titles: Record<WelcomePackId, string> = {
  website_build: "Website Build",
  website_seo: "Website + SEO",
  systems_portal: "Systems Portal",
};

export function WelcomePackLibrary({
  packs,
  selectedId,
  onChoose,
  actionLabel = "Open packet",
  disabled = false,
  requireDesignedPublished = false,
}: Readonly<{
  packs: readonly WelcomePack[];
  selectedId?: string;
  onChoose: (pack: WelcomePack) => void;
  actionLabel?: string;
  disabled?: boolean;
  requireDesignedPublished?: boolean;
}>): React.JSX.Element {
  return (
    <ul className={styles.library} aria-label="Predesigned welcome packets">
      {packs.map((pack) => {
        const published = pack.versions[0];
        const designed = published?.content.rendererVersion === 2;
        return (
          <li
            key={pack.id}
            className={`${styles.edition} ${selectedId === pack.id ? styles.editionSelected : ""}`}
          >
            <div className={styles.cover}>
              <Image
                alt=""
                className={styles.coverImage}
                src={packetAssets[getPacketEdition(pack.id).coverImageId].src}
                width={640}
                height={400}
              />
              <div className={styles.coverCopy}>
                <p>FSS · CLIENT WELCOME</p>
                <h3>{titles[pack.id]}</h3>
              </div>
            </div>
            <div className={styles.editionInfo}>
              <p>{descriptions[pack.id]}</p>
              <div className={styles.actions}>
                <span className={styles.progress}>
                  <BookOpen aria-hidden="true" size={16} />
                  {designed
                    ? "10 pages"
                    : published
                      ? `${published.content.guide.length} sections`
                      : "Not published"}
                </span>
                <StatusBadge
                  status={pack.versions.length ? "success" : "neutral"}
                >
                  {published
                    ? `Published v${pack.publishedVersion}`
                    : "Draft edition"}
                </StatusBadge>
              </div>
              {requireDesignedPublished && published && !designed ? (
                <p>Publish the ten-page edition before using this packet.</p>
              ) : null}
              <PortalButton
                disabled={disabled || (requireDesignedPublished && !designed)}
                onClick={() => onChoose(pack)}
                variant="secondary"
                type="button"
              >
                {actionLabel}
                <ArrowRight aria-hidden="true" size={16} />
              </PortalButton>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
