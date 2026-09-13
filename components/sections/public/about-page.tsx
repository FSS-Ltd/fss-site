import Link from "next/link";
import Image from "next/image";
import { organisation } from "@/lib/seo/organisation";
import { ContactLink, PageIntro } from "./page-intro";
import { RelatedLinks } from "./related-links";
import { sectorLink } from "@/lib/commercial/links";
import styles from "./public-page.module.css";

export function AboutPage() {
  return (
    <div className={styles.page}>
      <PageIntro
        eyebrow="About FSS"
        title="Faithful by name. Dependable by design."
        image={
          <div
            className={styles.editorialFrame}
            data-motion-parallax="0.06"
            aria-hidden="true"
          >
            <Image
              src="/images/editorial/about-human-craft-v1.webp"
              alt=""
              width={2048}
              height={1280}
              sizes="(max-width: 900px) 92vw, 43vw"
              className={styles.editorialImage}
              priority
            />
          </div>
        }
      >
        <p className="max-w-2xl text-lg sm:text-xl">
          Faithful Software Solutions is a UK software studio founded by{" "}
          {organisation.founder.name}. We build custom software for charities,
          faith organisations, schools and businesses.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <ContactLink />
        </div>
      </PageIntro>
      <section
        className={styles.grid}
        aria-label="Our approach"
        data-motion-reveal="mask"
      >
        <div data-motion-reveal="left">
          <h2>Care for the work and the people behind it.</h2>
          <p>
            Our faith-rooted ethos shapes how we approach software: honesty
            about scope, respect for the people whose data passes through a
            system, and care for the quality of what we deliver.
          </p>
        </div>
        <div data-motion-reveal="right">
          <h2>Make the decisions clear.</h2>
          <p>
            Understand the problem, document the choices and agree the next
            step. A useful system needs maintainable code, accessible interfaces
            and a practical handover.
          </p>
        </div>
      </section>
      <section
        className={styles.section}
        aria-labelledby="about-work"
        data-motion-reveal="left"
      >
        <h2 id="about-work">Built by FSS: NexSteps.</h2>
        <p>
          NexSteps brings safeguarding, attendance and operations into a
          platform for schools, churches and community organisations. It
          reflects the operational settings our work serves.
        </p>
        <Link
          href="/work/nexsteps"
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          Read the NexSteps case study
        </Link>
      </section>
      <section
        className={styles.section}
        aria-labelledby="company-title"
        data-motion-reveal="right"
      >
        <h2 id="company-title">Company details</h2>
        <p>
          {organisation.legalName}
          <br />
          Registered in England and Wales · Company number{" "}
          {organisation.companyNumber}
        </p>
        <Link
          href="/services"
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          See how we can help
        </Link>
      </section>
      <RelatedLinks links={[sectorLink]} />
    </div>
  );
}
