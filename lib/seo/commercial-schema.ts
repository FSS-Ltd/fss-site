import type {
  CommercialPageContent,
  CommercialLink,
} from "@/lib/commercial/types";
import { canonicalUrl, pageSchemaId, socialImage } from "./metadata";
import { organisation } from "./organisation";
import { churchArticle } from "@/lib/commercial/church-article";

export function commercialBreadcrumbs(
  page: CommercialPageContent,
): CommercialLink[] {
  const parent =
    page.kind === "service"
      ? [{ href: "/services", label: "Services" }]
      : page.kind === "article"
        ? [{ href: "/blog", label: "Blog" }]
        : [];
  return [
    { href: "/", label: "Home" },
    ...parent,
    { href: page.path, label: page.label },
  ];
}

export function buildCommercialSchema(
  page: CommercialPageContent,
): Record<string, unknown> {
  const url = canonicalUrl(page.path);
  const organisationId = `${organisation.url}/#organization`;
  const graph: Record<string, unknown>[] = [
    {
      "@type": "WebPage",
      "@id": pageSchemaId(page.path, "webpage"),
      url,
      name: page.title,
      description: page.description,
      dateModified: page.modifiedDate,
      inLanguage: "en-GB",
      isPartOf: { "@id": `${organisation.url}/#website` },
      publisher: { "@id": organisationId },
      breadcrumb: { "@id": pageSchemaId(page.path, "breadcrumbs") },
    },
    {
      "@type": "BreadcrumbList",
      "@id": pageSchemaId(page.path, "breadcrumbs"),
      itemListElement: commercialBreadcrumbs(page).map((item, index) => ({
        "@type": "ListItem",
        position: index + 1,
        name: item.label,
        item: canonicalUrl(item.href),
      })),
    },
    {
      "@type": "FAQPage",
      "@id": pageSchemaId(page.path, "faq"),
      isPartOf: { "@id": pageSchemaId(page.path, "webpage") },
      mainEntity: page.faqs.map((faq) => ({
        "@type": "Question",
        name: faq.question,
        acceptedAnswer: { "@type": "Answer", text: faq.answer },
      })),
    },
  ];
  if (page.kind === "service") {
    graph.push({
      "@type": "Service",
      "@id": pageSchemaId(page.path, "service"),
      name: page.label,
      description: page.answer,
      url,
      provider: { "@id": organisationId },
      areaServed: { "@type": "Country", name: organisation.areaServed },
      mainEntityOfPage: { "@id": pageSchemaId(page.path, "webpage") },
    });
  }
  if (
    page.kind === "article" ||
    page.kind === "guide" ||
    page.kind === "case-study"
  ) {
    graph.push({
      "@type": "Article",
      "@id": pageSchemaId(page.path, "article"),
      headline: page.heading,
      description: page.answer,
      url,
      image: socialImage(page.path, page.title).url,
      dateModified: page.modifiedDate,
      author: { "@id": organisationId },
      ...(page.path === "/blog/church-management-software-vs-bespoke"
        ? { datePublished: churchArticle.meta.publishDate }
        : {}),
      publisher: { "@id": organisationId },
      mainEntityOfPage: { "@id": pageSchemaId(page.path, "webpage") },
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
