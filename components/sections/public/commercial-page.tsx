import Link from "next/link";
import Image from "next/image";
import type {
  CommercialPageContent,
  CommercialSection,
} from "@/lib/commercial/types";
import {
  buildCommercialSchema,
  commercialBreadcrumbs,
} from "@/lib/seo/commercial-schema";
import { JsonLd } from "@/components/seo/json-ld";
import { organisation } from "@/lib/seo/organisation";
import { ContactLink, PageIntro } from "./page-intro";
import type { MeshSection } from "@/components/ui/mesh-band";
import { DeliverySteps } from "./delivery-steps";
import { RelatedLinks } from "./related-links";
import styles from "./public-page.module.css";
import { ContentEvidence } from "@/components/seo/content-evidence";
import { churchArticle } from "@/lib/commercial/church-article";

function ContentSection({ section }: { section: CommercialSection }) {
  return (
    <section
      className={styles.section}
      aria-labelledby={section.id}
      data-motion-reveal="mask"
    >
      <h2 id={section.id}>{section.title}</h2>
      <p className="max-w-3xl">{section.text}</p>
      {section.links?.map((link) => (
        <p key={link.href}>
          <Link href={link.href} className="underline underline-offset-4">
            {link.label}
          </Link>
        </p>
      ))}
      {section.points && (
        <ul className={styles.list}>
          {section.points.map((point) => (
            <li key={point}>{point}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

const headerSection: Record<CommercialPageContent["kind"], MeshSection> = {
  service: "services",
  sector: "services",
  "case-study": "work",
  guide: "resources",
  article: "blog",
};

export function CommercialPage({ page }: { page: CommercialPageContent }) {
  return (
    <>
      <JsonLd data={buildCommercialSchema(page)} />
      <article className={styles.page}>
        <nav aria-label="Breadcrumb" className="mb-8">
          <ol className="flex flex-wrap items-center gap-x-3 text-sm">
            {commercialBreadcrumbs(page).map((item, index, items) => (
              <li key={item.href} className="flex items-center gap-3">
                {index > 0 && <span aria-hidden="true">/</span>}
                {index === items.length - 1 ? (
                  <span aria-current="page">{item.label}</span>
                ) : (
                  <Link
                    href={item.href}
                    className="inline-flex min-h-11 items-center underline underline-offset-4"
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
        <PageIntro
          section={headerSection[page.kind]}
          eyebrow={page.label}
          title={page.heading}
          image={
            page.kind === "case-study" ? (
              <div
                className={styles.editorialFrame}
                data-motion-parallax="0.06"
                style={{ aspectRatio: "5 / 2" }}
              >
                {/* One real card from the dashboard, cropped by position, not edited. */}
                <Image
                  src="/redesign/products/admin-dashboard.png"
                  alt="NexSteps Today's Sessions card, from the operations dashboard built by FSS"
                  width={4112}
                  height={2406}
                  sizes="(max-width: 900px) 350vw, 165vw"
                  style={{
                    position: "absolute",
                    maxWidth: "none",
                    width: "384.6%",
                    height: "auto",
                    left: "-117.3%",
                    top: "-66.4%",
                  }}
                  priority
                />
              </div>
            ) : undefined
          }
        >
          <p className="max-w-2xl text-lg sm:text-xl">{page.answer}</p>
          <p className="text-sm">
            By {organisation.name} · Updated{" "}
            <time dateTime={page.modifiedDate}>{page.modifiedDate}</time>
          </p>
          <div className="mt-7">
            <ContactLink />
          </div>
        </PageIntro>
        {page.path === "/blog/church-management-software-vs-bespoke" && (
          <ContentEvidence content={churchArticle.meta} />
        )}
        {page.sections.map((section) => (
          <ContentSection key={section.id} section={section} />
        ))}
        {page.kind !== "article" && <DeliverySteps />}
        <section
          className={styles.section}
          aria-labelledby="faq-title"
          data-motion-reveal="up"
        >
          <h2 id="faq-title">Frequently asked questions</h2>
          {page.faqs.map((faq) => (
            <div key={faq.question} className="max-w-3xl">
              <h3>{faq.question}</h3>
              <p>{faq.answer}</p>
            </div>
          ))}
        </section>
        <RelatedLinks links={page.related} />
      </article>
    </>
  );
}
