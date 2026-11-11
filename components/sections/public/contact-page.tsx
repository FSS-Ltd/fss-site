import { ContactForm } from "@/components/forms/contact-form";
import { organisation } from "@/lib/seo/organisation";
import { Faq } from "./faq";
import { PageIntro } from "./page-intro";
import { RelatedLinks } from "./related-links";
import { sectorLink, nexstepsLink, costLink } from "@/lib/commercial/links";
import styles from "./public-page.module.css";
import contactStyles from "./contact-page.module.css";
import compactStyles from "./compact-hero.module.css";

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
    <div className={`${styles.page} ${compactStyles.pageCompact}`}>
      <PageIntro
        compact={{
          hero: compactStyles.heroCompact,
          canvas: compactStyles.canvasCompact,
          eyebrow: compactStyles.eyebrowCompact,
        }}
        eyebrow="Five short questions"
        title="Tell us what you want off your plate"
      >
        <p className={compactStyles.heroLead}>
          AI, automation and custom software for businesses of any size.
        </p>
      </PageIntro>
      <div className={`${styles.grid} ${contactStyles.contactGrid}`}>
        <ContactForm
          aside={
            <div className={contactStyles.nextSteps}>
              <h2 id="contact-next">What happens next</h2>
              <ol className={contactStyles.timeline}>
                <li>
                  <span aria-hidden="true">01</span>
                  We review your project and constraints.
                </li>
                <li>
                  <span aria-hidden="true">02</span>
                  We reply with questions or a suggested next step.
                </li>
                <li>
                  <span aria-hidden="true">03</span>
                  If there is a fit, we discuss scope and a proposal.
                </li>
              </ol>
              <p>
                Submitting this form sends an enquiry. It does not book a call
                or commit you to a project.
              </p>
              <a
                className={contactStyles.mailLink}
                href={`mailto:${organisation.email}`}
              >
                <span className={contactStyles.mailLabel}>Prefer email?</span>
                <span className={contactStyles.mailAddress}>
                  {organisation.email}
                  <span aria-hidden="true" className={contactStyles.mailArrow}>
                    →
                  </span>
                </span>
              </a>
            </div>
          }
        />
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
