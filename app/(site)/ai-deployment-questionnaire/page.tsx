import type { Metadata } from "next";
import { createPageMetadata } from "@/lib/seo/metadata";
import { publicPages } from "@/lib/seo/pages";

import {
  AiQuestionnairePage,
  aiQuestionnaireFaqs,
} from "@/components/sections/ai-questionnaire/ai-questionnaire-page";
import { JsonLd } from "@/components/seo/json-ld";
import { siteConfig } from "@/lib/site-config";

const path = "/ai-deployment-questionnaire";
const pageUrl = `${siteConfig.url}${path}`;

export const metadata: Metadata = createPageMetadata(
  publicPages["/ai-deployment-questionnaire"],
);

function AiQuestionnaireSchema() {
  const schema = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        "@id": `${pageUrl}#webpage`,
        url: pageUrl,
        name: "Local AI vs Cloud AI Questionnaire",
        description:
          "A questionnaire that helps privacy-sensitive businesses decide whether local AI, cloud AI, or hybrid AI is the right deployment model.",
        isPartOf: {
          "@type": "WebSite",
          name: siteConfig.name,
          url: siteConfig.url,
        },
      },
      {
        "@type": "Service",
        "@id": `${pageUrl}#service`,
        name: "Private AI Workflow Audit",
        serviceType: "AI workflow automation and private AI consulting",
        description:
          "Workflow audit for businesses deciding whether to use local AI, cloud AI, or hybrid AI for sensitive internal automation.",
        provider: {
          "@type": "ProfessionalService",
          name: siteConfig.fullName,
          url: siteConfig.url,
        },
        areaServed: {
          "@type": "Country",
          name: "United Kingdom",
        },
        audience: {
          "@type": "BusinessAudience",
          audienceType:
            "Law firms, clinics, hospitals, finance teams, charities, and privacy-sensitive service businesses",
        },
      },
      {
        "@type": "FAQPage",
        "@id": `${pageUrl}#faq`,
        mainEntity: aiQuestionnaireFaqs.map((faq) => ({
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

export default function AiDeploymentQuestionnaireRoute() {
  return (
    <>
      <AiQuestionnaireSchema />
      <AiQuestionnairePage />
    </>
  );
}
