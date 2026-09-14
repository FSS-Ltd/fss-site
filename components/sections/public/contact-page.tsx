import { ContactForm } from "@/components/forms/contact-form";
import { organisation } from "@/lib/seo/organisation";
import { Faq } from "./faq";
import { PageIntro } from "./page-intro";
import { RelatedLinks } from "./related-links";
import { sectorLink, nexstepsLink, costLink } from "@/lib/commercial/links";
import styles from "./public-page.module.css";

const questions = [
  {
    id: "contact-existing-system",
    question: "Can you work with an existing system?",
    answer:
      "We can review an existing codebase, integrations and operational needs before recommending whether to stabilise, extend or replace it. The first step is understanding its current condition.",
  },
  {
    id: "contact-budget",
    question: "What if we have a limited budget?",
    answer:
      "Tell us your constraints. We can discuss a smaller first scope or a simpler approach. We agree the work and costs before a build begins.",
  },
  {
    id: "contact-ai-data",
    question: "How do you approach sensitive data in AI projects?",
    answer:
      "We assess data access, hosting and review requirements before selecting a model or deployment approach. Private or local deployment can be considered where it fits; privacy depends on the whole system and its operation.",
  },
];

export function ContactPageContent() {
  return (
    <div className={styles.page}>
      <PageIntro
        eyebrow="Contact FSS"
        title="Discuss a custom software project"
      >
        <p className="max-w-2xl text-lg sm:text-xl">
          Tell us about your organisation and the problem you want to solve. We
          will review your enquiry and reply about how we can help.
        </p>
      </PageIntro>
      <div className={styles.grid}>
        <ContactForm />
        <aside aria-labelledby="contact-next" data-motion-reveal="right">
          <h2 id="contact-next">What happens next</h2>
          <ol className={styles.list}>
            <li>We review your project and constraints.</li>
            <li>We reply with questions or a suggested next step.</li>
            <li>If there is a fit, we discuss scope and a proposal.</li>
          </ol>
          <p>
            Submitting this form sends an enquiry. It does not book a call or
            commit you to a project.
          </p>
          <a
            className="inline-flex min-h-11 items-center font-medium underline underline-offset-4"
            href={`mailto:${organisation.email}`}
          >
            Email {organisation.email}
          </a>
        </aside>
      </div>
      <section
        className={styles.section}
        aria-labelledby="contact-faq"
        data-motion-reveal="mask"
      >
        <h2 id="contact-faq">Before you reach out</h2>
        <Faq items={questions} />
      </section>
      <RelatedLinks links={[sectorLink, nexstepsLink, costLink]} />
    </div>
  );
}
