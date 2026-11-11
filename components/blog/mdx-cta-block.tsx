import { ButtonLink } from "@/components/ui/button";

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
    <div className={styles.cta}>
      <p className={styles.ctaTitle}>{title}</p>
      <p className={styles.ctaBody}>{body}</p>
      <ButtonLink href={href} variant="primary">
        {ctaLabel}
      </ButtonLink>
    </div>
  );
}
