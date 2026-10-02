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
}: Readonly<{
  packs: readonly WelcomePack[];
  selectedId?: string;
  onChoose: (pack: WelcomePack) => void;
  actionLabel?: string;
  disabled?: boolean;
}>): React.JSX.Element {
  return (
    <ul className={styles.library} aria-label="Predesigned welcome packets">
      {packs.map((pack) => (
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
                {pack.content.rendererVersion === 2
                  ? "10 pages"
                  : `${pack.content.guide.length} sections`}
              </span>
              <StatusBadge
                status={pack.versions.length ? "success" : "neutral"}
              >
                {pack.versions.length
                  ? `Published v${pack.publishedVersion}`
                  : "Draft edition"}
              </StatusBadge>
            </div>
            <PortalButton
              disabled={disabled}
              onClick={() => onChoose(pack)}
              variant="secondary"
              type="button"
            >
              {actionLabel}
              <ArrowRight aria-hidden="true" size={16} />
            </PortalButton>
          </div>
        </li>
      ))}
    </ul>
  );
}
