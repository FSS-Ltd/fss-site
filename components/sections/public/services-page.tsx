import Link from "next/link";
import Image from "next/image";
import { ContactLink, PageIntro } from "./page-intro";
import { DeliverySteps } from "./delivery-steps";
import { RelatedLinks } from "./related-links";
import {
  aiServiceLinks,
  sectorLink,
  serviceLinks,
  costLink,
} from "@/lib/commercial/links";
import styles from "./public-page.module.css";
import railStyles from "./service-rail.module.css";
import cta from "@/components/ui/cta-motion.module.css";

const services = [
  {
    title: "AI integration",
    description:
      "Add AI to your CRM, inbox, documents and accounts. Agree what data it can see, what it may do and who approves it before anything is built.",
  },
  {
    title: "AI agents and receptionists",
    description:
      "Agents for defined back-office tasks and a receptionist for calls and messages, each with approval steps, logs and a handover to your team.",
  },
  {
    title: "AI readiness audit",
    description:
      "Find where AI fits and where it does not. A written recommendation on what to automate first and what to fix before building.",
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
  {
    title: "Custom software, portals and modernisation",
    description:
      "Operational systems, client portals, dashboards and integrations, plus modernisation of ageing systems, designed around your workflows, permissions and reporting needs.",
  },
];

export function ServicesPage() {
  return (
    <div className={styles.page}>
      <PageIntro
        eyebrow="Services"
        title="AI and software built around your business."
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
          AI integration, automation and custom software for businesses of any
          size, and for charities, faith organisations and schools. We start
          with the operational problem and agree the scope with you.
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-6">
          <ContactLink />
        </div>
      </PageIntro>
      <section
        aria-label="AI and software services"
        className={railStyles.scene}
        data-motion-scene
      >
        <div className={railStyles.viewport}>
          <div className={railStyles.rail} data-motion-track>
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
          <p className={railStyles.hint} aria-hidden="true">
            Keep scrolling to see all six services <span>→</span>
          </p>
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
          operations, including role-scoped access and parent onboarding. It is
          operational software, not an AI deployment.
        </p>
        <Link
          href="/work/nexsteps"
          className={`inline-block py-3 font-medium underline underline-offset-4 ${cta.link}`}
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
      <RelatedLinks
        links={[...aiServiceLinks, ...serviceLinks, sectorLink, costLink]}
      />
    </div>
  );
}
