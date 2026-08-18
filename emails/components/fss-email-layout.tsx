import type { ReactNode } from "react";
import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

import { EmailImage, type FssEmailImageProps } from "./email-image";
import { emailColors, emailFontFamily, emailSpacing } from "../styles";

const REPLY_TO_EMAIL = "j.ntagengwa@faithfulsoftware.dev";
const COMPANY_NAME = "Faithful Software Solutions Ltd";

export type FssEmailCategory = "transactional" | "resource-delivery" | "newsletter";

export type FssEmailLayoutProps = {
  category: FssEmailCategory;
  previewText: string;
  title: string;
  children: ReactNode;
  image?: FssEmailImageProps;
  unsubscribeUrl?: string;
};

const FOOTER_REASON: Record<FssEmailCategory, string> = {
  transactional: `You are receiving this because you contacted ${COMPANY_NAME}.`,
  "resource-delivery": `You are receiving this because you requested this resource from ${COMPANY_NAME}.`,
  newsletter: "You are receiving this because you subscribed to FSS Field Notes.",
};

export function FssEmailLayout(props: FssEmailLayoutProps) {
  if (props.category === "newsletter" && !props.unsubscribeUrl?.trim()) {
    throw new TypeError("Newsletter emails require an unsubscribe URL.");
  }

  return (
    <Html lang="en">
      <Head />
      <Preview>{props.previewText}</Preview>
      <Body style={{ backgroundColor: emailColors.background, fontFamily: emailFontFamily, margin: 0, padding: 0 }}>
        <Container
          style={{
            maxWidth: emailSpacing.containerMaxWidth,
            margin: "0 auto",
            backgroundColor: emailColors.surface,
            padding: emailSpacing.gutter,
          }}
        >
          <Section style={{ paddingBottom: emailSpacing.gutter / 2 }}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 700,
                color: emailColors.secondary,
                margin: 0,
              }}
            >
              Faithful Software Solutions
            </Text>
          </Section>

          <Heading
            as="h1"
            style={{ fontSize: 22, color: emailColors.text, margin: `0 0 ${emailSpacing.gutter / 2}px` }}
          >
            {props.title}
          </Heading>

          {props.image ? (
            <Section style={{ paddingBottom: emailSpacing.gutter / 2 }}>
              <EmailImage {...props.image} />
            </Section>
          ) : null}

          <Section style={{ color: emailColors.text, fontSize: 16, lineHeight: 1.6 }}>{props.children}</Section>

          <Hr style={{ borderColor: emailColors.border, margin: `${emailSpacing.gutter}px 0` }} />

          <Text style={{ fontSize: 12, color: emailColors.textMuted, margin: "0 0 4px" }}>
            {COMPANY_NAME} &middot; {FOOTER_REASON[props.category]}
          </Text>
          <Text style={{ fontSize: 12, color: emailColors.textMuted, margin: "0 0 4px" }}>
            Reply to this email or write to {REPLY_TO_EMAIL}.
          </Text>
          {props.category === "newsletter" && props.unsubscribeUrl ? (
            <Text style={{ fontSize: 12, color: emailColors.textMuted, margin: 0 }}>
              <Link href={props.unsubscribeUrl} style={{ color: emailColors.primary }}>
                Unsubscribe
              </Link>
            </Text>
          ) : null}
        </Container>
      </Body>
    </Html>
  );
}
