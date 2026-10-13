import Image from "next/image";
import { ArrowDown, ArrowUpRight } from "lucide-react";

import type { ResourceMeta } from "@/lib/types/resource";
import styles from "./guide-hero.module.css";

export function GuideHero({ resource }: { resource: ResourceMeta }) {
  return (
    <section className={styles.hero} aria-labelledby="guide-title">
      <div className={styles.topline}>
        <span>The practical business systems series</span>
        <span>FSS FIELD GUIDE / 2026</span>
      </div>
      <div className={styles.grid}>
        <div className={styles.intro}>
          <p className={styles.eyebrow}>
            <span /> Free guide · 28-page PDF
          </p>
          <h1 id="guide-title">
            The AI receptionist <em>setup guide.</em>
          </h1>
          <p className={styles.promise}>
            Answer routine calls.
            <br />
            Book genuine appointments.
            <br />
            Keep a human route.
          </p>
          <p className={styles.description}>
            A practical first pilot for clinics, spas and appointment-based
            businesses. From your first business rule to your final test call.
          </p>
          <a className={styles.cta} href="#download-form">
            Get the free guide <ArrowUpRight size={19} aria-hidden="true" />
          </a>
          <p className={styles.note}>
            Free PDF. Instant access after submitting your details.
          </p>
        </div>
        <figure className={styles.figure}>
          <div className={styles.bookStage}>
            <div className={styles.book}>
              <Image
                src={resource.coverImage}
                alt="The AI receptionist setup guide by Jean-Fidele Ntagengwa, with its original warm black and rust cover"
                width={990}
                height={1400}
                priority
                sizes="(max-width: 760px) 74vw, 390px"
              />
            </div>
            <span className={styles.edition}>
              A PRACTICAL GUIDE.
              <br />A CONSIDERED FIRST STEP.
            </span>
          </div>
          <figcaption>
            By Jean-Fidele Ntagengwa <span>·</span> Founder, FSS
          </figcaption>
        </figure>
      </div>
      <div className={styles.bottomline}>
        <span>Built for a first pilot. Designed to keep you in control.</span>
        <a href="#inside-guide">
          Take a look inside <ArrowDown size={16} aria-hidden="true" />
        </a>
      </div>
    </section>
  );
}
