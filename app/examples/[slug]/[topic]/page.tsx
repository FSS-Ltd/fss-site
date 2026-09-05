import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  sectorExamples,
  findSectorExample,
} from "@/lib/sector-examples/catalog";
import { exampleServices } from "@/lib/sector-examples/services";
import { ExampleChrome } from "@/components/sector-examples/chrome";
import { ExampleEnquiry } from "@/components/sector-examples/enquiry";
import { ExampleMotion } from "@/components/sector-examples/motion";

type Props = { params: Promise<{ slug: string; topic: string }> };
export const dynamicParams = false;
export function generateStaticParams() {
  return sectorExamples.flatMap((example) =>
    exampleServices[example.theme].map((service) => ({
      slug: example.slug,
      topic: service.slug,
    })),
  );
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug, topic } = await params;
  const example = findSectorExample(slug);
  const service =
    example &&
    exampleServices[example.theme].find((item) => item.slug === topic);
  return {
    title:
      service && example
        ? `${service.title} | ${example.name}`
        : "Service not found",
    description: service?.description,
    alternates: { canonical: `/examples/${slug}/${topic}` },
  };
}
export default async function ServicePage({ params }: Props) {
  const { slug, topic } = await params;
  const example = findSectorExample(slug);
  if (!example) notFound();
  const service = exampleServices[example.theme].find(
    (item) => item.slug === topic,
  );
  if (!service) notFound();
  return (
    <ExampleMotion>
      <ExampleChrome example={example}>
        <article className="example-service-page" id="services">
          <nav aria-label="Breadcrumb">
            <Link href={`/examples/${slug}`}>{example.name}</Link>
            <span aria-hidden="true">/</span>
            <span>{service.title}</span>
          </nav>
          <header>
            <p className="example-eyebrow">
              The service, explained / {example.sector}
            </p>
            <h1>{service.title}.</h1>
            <p>{service.description}</p>
            <a className="example-button" href="#enquire">
              Talk through what you need ↗
            </a>
          </header>
          <div className="example-service-body">
            <section id="approach">
              <p className="example-eyebrow">What to expect</p>
              <h2>A clearer way forward.</h2>
              <ol>
                {service.steps.map(([title, body], index) => (
                  <li key={title} data-reveal>
                    <span>0{index + 1}</span>
                    <div>
                      <h3>{title}</h3>
                      <p>{body}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            <aside>
              <p className="example-eyebrow">Before we talk</p>
              <h2>A little preparation helps.</h2>
              <ul>
                {service.preparation.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <a href="#enquire">Prepare your conversation ↗</a>
            </aside>
          </div>
          <section className="example-service-faq" data-reveal>
            <p className="example-eyebrow">A useful answer</p>
            <h2>{service.question}</h2>
            <p>{service.answer}</p>
          </section>
        </article>
        <ExampleEnquiry theme={example.theme} />
      </ExampleChrome>
    </ExampleMotion>
  );
}
