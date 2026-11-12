import Link from "next/link";
import type { CommercialSection } from "@/lib/commercial/types";
import cta from "@/components/ui/cta-motion.module.css";
import styles from "./section-spine.module.css";

/** Two-digit node label for the nth (zero-based) section on the spine. */
export function spineNumber(index: number) {
  return String(index + 1).padStart(2, "0");
}

/**
 * The page's sections as one path: a vertical line, a numbered node for each
 * section and its text beside it. Odd and even sections sit at different
 * offsets, and the last node is filled, as the workflow line ends at FSS.
 */
export function SectionSpine({
  sections,
}: {
  sections: readonly CommercialSection[];
}) {
  return (
    <ol className={styles.spine}>
      {sections.map((section, index) => (
        <li
          key={section.id}
          className={styles.node}
          data-motion-reveal="up"
          data-last={index === sections.length - 1 || undefined}
        >
          <span className={styles.number} aria-hidden="true">
            {spineNumber(index)}
          </span>
          <section className={styles.body} aria-labelledby={section.id}>
            <h2 id={section.id}>{section.title}</h2>
            <p>{section.text}</p>
            {section.links?.map((link) => (
              <p key={link.href}>
                <Link
                  href={link.href}
                  className={`underline underline-offset-4 ${cta.link}`}
                >
                  {link.label}
                </Link>
              </p>
            ))}
            {section.points && (
              <ul className={styles.points}>
                {section.points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            )}
          </section>
        </li>
      ))}
    </ol>
  );
}
