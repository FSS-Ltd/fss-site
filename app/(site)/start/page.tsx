import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import {
  BusinessIntakePage,
  businessIntakeFaqs,
} from "@/components/sections/business-intake/business-intake-page";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/site-config";

const path = "/start";
const pageUrl = `${siteConfig.url}${path}`;

export const metadata: Metadata = createPageMetadata(publicPages["/start"]);

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
