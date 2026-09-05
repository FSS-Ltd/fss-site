import Image from "next/image";
import Link from "next/link";
import type { ExampleTheme } from "@/lib/sector-examples/catalog";
import { exampleServices } from "@/lib/sector-examples/services";

export function VariantImage({
  src,
  alt,
  className = "",
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <div className={`variant-image ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        priority={priority}
        sizes="(max-width: 760px) 100vw, 60vw"
      />
    </div>
  );
}
export function VariantServices({
  theme,
  slug,
  title,
}: {
  theme: ExampleTheme;
  slug: string;
  title: string;
}) {
  return (
    <section className="variant-services example-section" id="services">
      <div className="variant-section-top" data-reveal>
        <p className="example-eyebrow">The right support / Explained clearly</p>
        <h2>{title}</h2>
      </div>
      <div className="variant-service-grid">
        {exampleServices[theme].map((service, index) => (
          <article key={service.slug} data-reveal>
            <span className="example-eyebrow">0{index + 1}</span>
            <h3>{service.title.replace(" in Kent", "")}</h3>
            <p>{service.description}</p>
            <Link href={`/examples/${slug}/${service.slug}`}>
              Explore the service <span aria-hidden="true">↗</span>
            </Link>
          </article>
        ))}
      </div>
    </section>
  );
}
export function VariantProcess({
  title,
  steps,
}: {
  title: string;
  steps: readonly [string, string][];
}) {
  return (
    <section className="variant-process example-section" id="approach">
      <div data-reveal>
        <p className="example-eyebrow">A clear way forward</p>
        <h2>{title}</h2>
        <a className="example-text-link" href="#enquire">
          Start the conversation ↗
        </a>
      </div>
      <ol>
        {steps.map(([heading, body], index) => (
          <li key={heading} data-reveal>
            <span>0{index + 1}</span>
            <div>
              <h3>{heading}</h3>
              <p>{body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
export function VariantQuestion({
  question,
  answer,
}: {
  question: string;
  answer: string;
}) {
  return (
    <section className="variant-question example-section" data-reveal>
      <p className="example-eyebrow">A question worth asking</p>
      <h2>{question}</h2>
      <p>{answer}</p>
      <a href="#enquire" className="example-text-link">
        Talk it through with us ↗
      </a>
    </section>
  );
}
