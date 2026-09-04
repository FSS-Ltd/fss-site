import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import styles from "./public-page.module.css";

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <header className={styles.hero}>
      <div className={styles.eyebrow}>{eyebrow}</div>
      <h1>{title}</h1>
      {children}
    </header>
  );
}

export function ContactLink() {
  return (
    <ButtonLink href="/contact" size="lg" className="min-h-12">
      Discuss your project <span aria-hidden="true">&nbsp;→</span>
    </ButtonLink>
  );
}
