import type { ReactNode } from "react";
import { Button, Hr, Section, Text } from "@react-email/components";

import type { NewsletterIssueContentInput, NewsletterSection } from "@/lib/growth/newsletter/content";
import { validateNewsletterIssueContent } from "@/lib/growth/newsletter/content";

import { FssEmailLayout } from "./components/fss-email-layout";
import { emailColors } from "./styles";

export type NewsletterIssueProps = NewsletterIssueContentInput & {
  postalAddress: string;
};

function requireMergeValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TypeError(`Newsletter issue requires a ${field}.`);
  }
  return trimmed;
}

function renderSection(section: NewsletterSection, index: number): ReactNode {
  const key = `newsletter-section-${index}`;

  switch (section.type) {
    case "position":
    case "case-note":
      return (
        <Section key={key} style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: 700, margin: "0 0 4px" }}>{section.heading}</Text>
          {section.body.map((paragraph, paragraphIndex) => (
            <Text key={paragraphIndex} style={{ margin: "0 0 8px" }}>
              {paragraph}
            </Text>
          ))}
        </Section>
      );
    case "practice":
      return (
        <Section key={key} style={{ marginBottom: 16 }}>
          <Text style={{ fontWeight: 700, margin: "0 0 4px" }}>{section.heading}</Text>
          {section.steps.map((step, stepIndex) => (
            <Text key={stepIndex} style={{ margin: "0 0 4px" }}>
              {stepIndex + 1}. {step}
            </Text>
          ))}
        </Section>
      );
    case "cta":
      return (
        <Section key={key} style={{ textAlign: "center", padding: "8px 0 16px" }}>
          <Button
            href={section.href}
            style={{
              backgroundColor: emailColors.primary,
              color: "#ffffff",
              fontSize: 16,
              fontWeight: 700,
              padding: "12px 24px",
              borderRadius: 4,
              textDecoration: "none",
            }}
          >
            {section.label}
          </Button>
        </Section>
      );
  }
}

export function NewsletterIssue(props: NewsletterIssueProps) {
  const content = validateNewsletterIssueContent(props);
  const postalAddress = requireMergeValue(props.postalAddress, "postal address");

  return (
    <FssEmailLayout
      category="newsletter"
      previewText={content.previewText}
      title={content.subject}
      unsubscribeUrl={content.unsubscribeUrl}
      image={content.image}
    >
      {content.sections.map((section, index) => renderSection(section, index))}
      {content.founderNote ? (
        <>
          <Hr style={{ borderColor: emailColors.border, margin: "16px 0" }} />
          <Text>{content.founderNote}</Text>
        </>
      ) : null}
      <Text style={{ fontSize: 12, color: emailColors.textMuted, margin: "8px 0 0" }}>
        {postalAddress}
      </Text>
    </FssEmailLayout>
  );
}
