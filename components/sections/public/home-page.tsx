import Link from "next/link";
import { ContactLink, PageIntro } from "./page-intro";
import { NexStepsProof } from "./nexsteps-proof";
import { DeliverySteps } from "./delivery-steps";
import styles from "./public-page.module.css";

export function HomePage() {
  return (
    <div className={styles.page}>
      <PageIntro
        eyebrow="Faithful Software Solutions · UK studio"
        title="Custom software for the work your mission depends on."
      >
        <p className="max-w-2xl text-lg sm:text-xl">
          We build custom software for UK charities and faith organisations:
          portals, operational systems and workflow automation shaped around
          your people.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <ContactLink />
          <Link
            href="#work"
            className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
          >
            Read the NexSteps case study
          </Link>
        </div>
      </PageIntro>
      <NexStepsProof />
      <section className={styles.section} aria-labelledby="services-title">
        <h2 id="services-title">Make your systems fit the way you work.</h2>
        <div className={styles.grid}>
          <div>
            <h3>Custom platforms and portals</h3>
            <p>
              Connect teams, members and services with operational software,
              dashboards and access built around each person’s role.
            </p>
          </div>
          <div>
            <h3>Workflows and integrations</h3>
            <p>
              Reduce repeated data entry and connect the tools your organisation
              relies on, with clear review and exception handling.
            </p>
          </div>
        </div>
        <Link
          href="/services"
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          Explore our services
        </Link>
      </section>
      <DeliverySteps />
    </div>
  );
}
