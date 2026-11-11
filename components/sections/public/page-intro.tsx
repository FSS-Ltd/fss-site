import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import styles from "./public-page.module.css";

export function PageIntro({
  eyebrow,
  title,
  children,
  image,
  compact,
}: {
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
        <div data-motion-reveal="mask">
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
