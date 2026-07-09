import type { Metadata } from "next";

import {
  BusinessIntakePage,
  businessIntakeFaqs,
} from "@/components/sections/business-intake/business-intake-page";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/site-config";

const path = "/start";
const pageUrl = `${siteConfig.url}${path}`;

export const metadata: Metadata = {
  title: "Business Idea Review | Should You Build an App, a Website, or an Audience First?",
  description:
    "Describe your business idea and goals. We'll review your answers and tell you whether the right first move is a website, an app, or building an audience before you build anything.",
  alternates: {
    canonical: path,
  },
  openGraph: {
    title: "Business Idea Review | Faithful Software Solutions",
    description:
      "Answer a few questions about your idea, your goals, and the evidence you have so far. Get a practical read on what to build first.",
    url: path,
    type: "website",
  },
};

function BusinessIntakeSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: "Business Idea Review",
        description:
          "A review form that helps founders decide whether to build a website, an app, or an audience first.",
        isPartOf: {
          "@type": "WebSite",
          name: siteConfig.name,
          url: siteConfig.url,
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: businessIntakeFaqs.map((faq) => ({
          "@type": "Question",
          name: faq.question,
          acceptedAnswer: {
            "@type": "Answer",
            text: faq.answer,
          },
        })),
      },
    ],
  };

  return <JsonLd data={schema} />;
}

export default function BusinessIntakeRoute() {
  return (
    <>
      <BusinessIntakeSchema />
      <BusinessIntakePage />
    </>
  );
}
