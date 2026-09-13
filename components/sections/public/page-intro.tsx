import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import styles from "./public-page.module.css";

export function PageIntro({
  eyebrow,
  title,
  children,
  image,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  image?: ReactNode;
}) {
  return (
    <header className={styles.hero} data-motion-reveal="mask">
      <canvas
        data-hero-canvas
        className={styles.particleCanvas}
        aria-hidden="true"
      />
      <div className={image ? styles.heroGrid : undefined}>
        <div>
          <div className={styles.eyebrow}>{eyebrow}</div>
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
