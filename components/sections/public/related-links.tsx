import Link from "next/link";
import type { CommercialLink } from "@/lib/commercial/types";
import styles from "./public-page.module.css";

export function RelatedLinks({ links }: { links: readonly CommercialLink[] }) {
  return (
    <section className={styles.section} aria-labelledby="related-reading">
      <h2
        id="related-reading"
        className="text-2xl font-semibold tracking-tight"
      >
        Related reading and next steps
      </h2>
      <ul className={styles.list}>
        {links.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href}
              className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
