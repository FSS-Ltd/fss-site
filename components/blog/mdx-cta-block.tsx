import Link from "next/link";

import cta from "@/components/ui/cta-motion.module.css";
import fill from "@/components/ui/cta-fill.module.css";
import styles from "@/components/blog/blog.module.css";

type MdxCtaBlockProps = {
  title: string;
  body: string;
  href?: string;
  ctaLabel?: string;
};

export function MdxCtaBlock({
  title,
  body,
  href = "/contact",
  ctaLabel = "Book a strategy call",
}: MdxCtaBlockProps) {
  return (
    <div className={styles.cta} data-lift-light>
      <p className={styles.ctaTitle}>{title}</p>
      <p className={styles.ctaBody}>{body}</p>
      <Link href={href} className={`${styles.ctaLink} ${cta.sweep} ${fill.rust}`}>
        {ctaLabel} <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}
