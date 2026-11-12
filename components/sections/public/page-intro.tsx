import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { MeshBand, type MeshSection } from "@/components/ui/mesh-band";
import styles from "./public-page.module.css";

export function PageIntro({
  eyebrow,
  title,
  children,
  image,
  compact,
  section,
}: {
  /** Which part of the site this header opens; drives the "0N / 0M" counter. */
  section: MeshSection;
  eyebrow: string;
  title: string;
  children: ReactNode;
  image?: ReactNode;
  /** Extra class names for a short one-line hero so the content below it leads the page. */
  compact?: { hero: string; canvas: string; eyebrow: string };
}) {
  return (
    <header
      className={compact ? `${styles.hero} ${compact.hero}` : styles.hero}
    >
      <canvas
        data-hero-canvas
        className={
          compact
            ? `${styles.particleCanvas} ${compact.canvas}`
            : styles.particleCanvas
        }
        aria-hidden="true"
      />
      <div className={image ? styles.heroGrid : undefined}>
        <div data-motion-reveal="mask" data-intro>
          <div
            className={
              compact ? `${styles.eyebrow} ${compact.eyebrow}` : styles.eyebrow
            }
          >
            {eyebrow}
          </div>
          <h1>{title}</h1>
          {children}
        </div>
        {image}
      </div>
      <MeshBand section={section} compact={Boolean(compact)} />
    </header>
  );
}

export function ContactLink() {
  return (
    <ButtonLink
      href="/contact"
      prefetch={false}
      size="lg"
      className="min-h-12"
      magnetic
    >
      Discuss your project <span aria-hidden="true">&nbsp;→</span>
    </ButtonLink>
  );
}
