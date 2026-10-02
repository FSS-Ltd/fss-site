import Image from "next/image";
import Link from "next/link";

import { LeadMagnetCaptureForm } from "@/components/forms/lead-magnet-capture-form";
import { Container } from "@/components/ui/container";
import type { ResourceMeta } from "@/lib/types/resource";

import styles from "./plumber-prompt-kit.module.css";

const tasks = [
  "Reply to a customer enquiry",
  "Tidy dictated job notes",
  "Format a quote draft",
  "Confirm a booking",
  "Summarise a completed job",
  "Draft a payment reminder",
  "Ask for an honest review",
  "Turn a real job into a social post",
];

type PlumberPromptKitPageProps = {
  resource: ResourceMeta;
};

export function PlumberPromptKitPage({ resource }: PlumberPromptKitPageProps) {
  const thankYouPath = `/resources/${resource.slug}/thank-you`;

  return (
    <div className={styles.page}>
      <Container>
        <div className={styles.hero}>
          <div className={styles.intro}>
            <Link href="/resources" className={styles.backLink}>
              ← Free resources
            </Link>
            <p className={styles.eyebrow}>Free guide · Six-page PDF</p>
            <h1>Less admin. More time on the tools.</h1>
            <p className={styles.lead}>
              Eight reusable AI prompts for the writing that comes with running
              a plumbing business. Draft enquiries, quotes, reminders and more
              from facts you supply, then make the final call yourself.
            </p>
            <p className={styles.credit}>
              By Jean-Fidele Ntagengwa · Faithful Software Solutions
            </p>
          </div>

          <aside className={styles.formCard} aria-labelledby="kit-form-title">
            <p className={styles.formEyebrow}>Your free prompt kit</p>
            <h2 id="kit-form-title">Get the six-page guide</h2>
            <p className={styles.formIntro}>
              Enter your details and the PDF will be ready to download
              immediately.
            </p>
            <LeadMagnetCaptureForm
              resourceSlug={resource.slug}
              sourceContext={`resource:${resource.slug}`}
              redirectPath={thankYouPath}
              ctaLabel="Get the free prompt kit"
              variant="compact-download"
            />
          </aside>

          <figure className={styles.preview}>
            <div className={styles.previewImage}>
              <Image
                src={resource.coverImage}
                alt="Cover of AI prompts for plumbers, a free prompt cheat sheet"
                width={884}
                height={1250}
                priority
              />
            </div>
            <figcaption>A look inside the six-page PDF</figcaption>
          </figure>
        </div>

        <section
          className={styles.contentSection}
          aria-labelledby="kit-includes-title"
        >
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>Inside the kit</p>
            <h2 id="kit-includes-title">One prompt for each everyday task.</h2>
            <p>
              Choose the message you need. Each prompt keeps missing details
              visible for your review.
            </p>
          </div>
          <ol className={styles.taskGrid}>
            {tasks.map((task, index) => (
              <li key={task}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                {task}
              </li>
            ))}
          </ol>
        </section>

        <section
          className={styles.exampleSection}
          aria-labelledby="kit-example-title"
        >
          <div>
            <p className={styles.eyebrow}>A practical starting point</p>
            <h2 id="kit-example-title">Start with one enquiry.</h2>
            <p>
              The guide includes an example about a dripping kitchen tap. The
              draft asks for the customer’s area, preferred days and access
              arrangements. It leaves availability for you to confirm.
            </p>
          </div>
          <blockquote>
            “Could you share your approximate area, your preferred days next
            week and any access arrangements? That will help me check whether I
            can offer a visit.”
            <cite>Illustrative reply from the guide</cite>
          </blockquote>
        </section>

        <section
          className={styles.contentSection}
          aria-labelledby="kit-steps-title"
        >
          <div className={styles.sectionIntro}>
            <p className={styles.eyebrow}>How it works</p>
            <h2 id="kit-steps-title">Copy. Adapt. Check.</h2>
          </div>
          <ol className={styles.stepGrid}>
            {resource.usageSteps?.map((step, index) => (
              <li key={step.title}>
                <span>0{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.description}</p>
              </li>
            ))}
          </ol>
          <p className={styles.safetyNote}>
            Keep customer details out of your AI assistant. The kit helps draft
            admin messages; it does not diagnose faults, give safety
            instructions, verify payments or send anything for you.
          </p>
        </section>
      </Container>
    </div>
  );
}
