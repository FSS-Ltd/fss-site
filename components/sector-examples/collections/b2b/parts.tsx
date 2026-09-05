import Link from "next/link";
import type { ExampleTheme } from "@/lib/sector-examples/catalog";
import { exampleServices } from "@/lib/sector-examples/services";

export function GuideIndex({
  theme,
  slug,
  title,
}: {
  theme: ExampleTheme;
  slug: string;
  title: string;
}) {
  return (
    <section id="services" className="b2b-guides">
      <div className="b2b-section-heading">
        <p className="example-eyebrow">Before you decide</p>
        <h2>{title}</h2>
      </div>
      <div>
        {exampleServices[theme].map((service, index) => (
          <Link key={service.slug} href={`/examples/${slug}/${service.slug}`}>
            <span className="b2b-guide-number">0{index + 1}</span>
            <div>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
            </div>
            <span aria-hidden="true">↗</span>
          </Link>
        ))}
      </div>
    </section>
  );
}

export function ProcurementSteps({
  equipment = false,
}: {
  equipment?: boolean;
}) {
  const steps = equipment
    ? [
        [
          "Define the work",
          "Vehicle mix, daily workload and the space available.",
        ],
        [
          "Check the site",
          "Access, floor, power and installation requirements.",
        ],
        [
          "Agree the scope",
          "Equipment, delivery, commissioning and support in writing.",
        ],
      ]
    : [
        [
          "Share your list",
          "Products, quantities and anything you buy regularly.",
        ],
        [
          "Compare properly",
          "Pack sizes, specifications, alternatives and delivery.",
        ],
        [
          "Agree the details",
          "A clear quote for the products and service you need.",
        ],
      ];
  return (
    <section id="approach" className="b2b-steps">
      <p className="example-eyebrow">A practical process</p>
      <h2>
        {equipment
          ? "From floor plan to working bay."
          : "Less chasing. More clarity."}
      </h2>
      <ol>
        {steps.map(([title, text], index) => (
          <li key={title}>
            <span>0{index + 1}</span>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
