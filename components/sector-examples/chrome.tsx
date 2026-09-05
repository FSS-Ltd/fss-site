import Link from "next/link";
import { exampleServices } from "@/lib/sector-examples/services";
import type { SectorExample } from "@/lib/sector-examples/catalog";

export function ExampleChrome({
  example,
  children,
}: {
  example: SectorExample;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`example-site example-${example.theme} example-design-${example.slug}`}
      data-example-slug={example.slug}
    >
      <a className="example-skip" href="#example-main">
        Skip to content
      </a>
      <div className="example-notice">
        <Link href="/examples">FSS / Example collection</Link>
        <span>Fictional company · Interactive demonstration</span>
        <a href="/contact">Discuss your website ↗</a>
      </div>
      <header className="example-header">
        <Link href={`/examples/${example.slug}`} className="example-wordmark">
          <span aria-hidden="true" className="example-symbol">
            {example.theme === "roof"
              ? "⌁"
              : example.theme === "estate"
                ? "✳"
                : example.theme === "auto"
                  ? "↗"
                  : "f."}
          </span>
          {example.name}
        </Link>
        <nav aria-label={`${example.name} navigation`}>
          <a href={`/examples/${example.slug}#services`}>
            {example.theme === "estate" ? "The collection" : "What we do"}
          </a>
          <a href={`/examples/${example.slug}#approach`}>Our approach</a>
        </nav>
        <a className="example-button small" href="#enquire">
          {example.theme === "estate"
            ? "Plan your move"
            : example.theme === "roof"
              ? "Start a roof survey"
              : "Let’s talk"}
          <span aria-hidden="true">↗</span>
        </a>
      </header>
      <main id="example-main">
        {children}
        <aside className="example-guide-directory" aria-label="Service guides">
          <p className="example-eyebrow">More detail before you decide</p>
          <h2>Explore the services.</h2>
          <div>
            {exampleServices[example.theme].map((service) => (
              <Link
                key={service.slug}
                href={`/examples/${example.slug}/${service.slug}`}
              >
                {service.title}
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </div>
        </aside>
      </main>
      <footer className="example-footer">
        <div>
          <p className="example-wordmark">{example.name}</p>
          <p>A fictional business. A real possibility.</p>
        </div>
        <div>
          <p>Designed & built by Faithful Software Solutions.</p>
          <a href="/contact">Make your next website work harder ↗</a>
          <Link href="/examples">Explore the full collection ↗</Link>
        </div>
        <small>
          Illustrative imagery and sample content. No bookings, payments or
          personal details are collected by this demonstration.
        </small>
      </footer>
    </div>
  );
}

export function SectionHeading({
  number,
  title,
  children,
}: {
  number: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="example-section-heading" data-reveal>
      <p className="example-eyebrow">
        {number} / {title}
      </p>
      {children}
    </div>
  );
}
