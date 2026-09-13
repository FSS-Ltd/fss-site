import Link from "next/link";
import Image from "next/image";
import { ContactLink, PageIntro } from "./page-intro";
import { DeliverySteps } from "./delivery-steps";
import { RelatedLinks } from "./related-links";
import { sectorLink, serviceLinks, costLink } from "@/lib/commercial/links";
import styles from "./public-page.module.css";

const services = [
  {
    title: "Custom software and portals",
    description:
      "Operational systems, member portals, dashboards and integrations designed around your organisation’s workflows, permissions and reporting needs.",
  },
  {
    title: "Apps and SaaS products",
    description:
      "Web and mobile products with the foundations for onboarding, subscriptions and ongoing development. Define the first useful release before expanding the scope.",
  },
  {
    title: "Workflow automation",
    description:
      "Connect existing tools and reduce repetitive work. Keep human review where judgement matters, with explicit handling for failures and exceptions.",
  },
  {
    title: "Private and local AI",
    description:
      "Assess whether self-hosted or on-device AI fits your data, hardware and operational needs. Deployment boundaries, access and oversight are part of the scope.",
  },
];

export function ServicesPage() {
  return (
    <div className={styles.page}>
      <PageIntro
        eyebrow="Services"
        title="Software built around your organisation."
        image={
          <div
            className={styles.editorialFrame}
            data-motion-parallax="0.07"
            aria-hidden="true"
          >
            <Image
              src="/images/editorial/services-workflow-v1.webp"
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
          Custom software, portals and automation for UK charities, faith
          organisations, schools and businesses. We start with the operational
          problem and agree the scope with you.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <ContactLink />
        </div>
      </PageIntro>
      <section
        aria-label="Software services"
        className={styles.serviceScene}
        data-motion-scene
      >
        <div className={styles.serviceViewport}>
          <div className={styles.serviceRail} data-motion-track>
            {services.map((service, index) => (
              <article
                key={service.title}
                data-motion-reveal={index % 2 === 0 ? "left" : "right"}
              >
                <span aria-hidden="true">0{index + 1}</span>
                <h2>{service.title}</h2>
                <p>{service.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>
      <section
        className={styles.section}
        aria-labelledby="service-evidence"
        data-motion-reveal="left"
      >
        <h2 id="service-evidence">See these foundations in NexSteps.</h2>
        <p>
          FSS built NexSteps for safeguarding, attendance and community
          operations, including role-scoped access and parent onboarding.
        </p>
        <Link
          href="/work/nexsteps"
          className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
        >
          Read the NexSteps case study
        </Link>
      </section>
      <DeliverySteps />
      <section
        className={styles.section}
        aria-labelledby="service-scope"
        data-motion-reveal="right"
      >
        <h2 id="service-scope">Scope depends on the work involved.</h2>
        <p>
          Data migration, integrations, user roles and support needs all affect
          a project. We discuss these before proposing a delivery approach and
          price.
        </p>
        <p>
          For founders exploring a new business idea, the{" "}
          <Link
            href="/start"
            className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
          >
            business idea review
          </Link>{" "}
          helps frame the first step.
        </p>
      </section>
      <RelatedLinks links={[...serviceLinks, sectorLink, costLink]} />
    </div>
  );
}
