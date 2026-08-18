import { Button, Section, Text } from "@react-email/components";

import { FssEmailLayout } from "./components/fss-email-layout";
import type { FssEmailImageProps } from "./components/email-image";
import { emailColors } from "./styles";

export const RESOURCE_DELIVERY_SUBJECT = "Your FSS practical guide is ready";
export const RESOURCE_DELIVERY_PREVIEW = "Download the resource you requested and choose one useful next step.";

export type ResourceDeliveryProps = {
  firstName: string;
  resourceTitle: string;
  resourceUrl: string;
  image?: FssEmailImageProps;
};

const listItemStyle = { margin: "0 0 4px" };

function requireMergeValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TypeError(`Resource delivery requires a ${field}.`);
  }
  return trimmed;
}

function requireResourceUrl(value: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") {
      throw new Error();
    }
  } catch {
    throw new TypeError("Resource delivery requires a valid HTTPS resource URL.");
  }
  return value;
}

export function ResourceDelivery(props: ResourceDeliveryProps) {
  const firstName = requireMergeValue(props.firstName, "first name");
  const resourceTitle = requireMergeValue(props.resourceTitle, "resource title");
  const resourceUrl = requireResourceUrl(props.resourceUrl);

  return (
    <FssEmailLayout
      category="resource-delivery"
      previewText={RESOURCE_DELIVERY_PREVIEW}
      title={RESOURCE_DELIVERY_SUBJECT}
      image={props.image}
    >
      <Text>Hi {firstName},</Text>
      <Text>
        Your copy of {resourceTitle} is ready.
      </Text>
      <Text>
        This guide is designed to help you find the part of a process that creates repeated work, missing
        information or avoidable delay. You do not need to change the whole system to make progress. Start
        with the one handoff that costs the team the most time.
      </Text>
      <Section style={{ textAlign: "center", padding: "8px 0 16px" }}>
        <Button
          href={resourceUrl}
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
          Download your guide
        </Button>
      </Section>
      <Text>
        If the button does not work, copy this link: {resourceUrl}
      </Text>
      <Text>As you work through it, write down:</Text>
      <Text style={listItemStyle}>1. where information first enters the process;</Text>
      <Text style={listItemStyle}>2. who has to retype, chase or correct it;</Text>
      <Text style={{ margin: 0 }}>3. what a cleaner handoff would make possible.</Text>
      <Text>
        If the guide exposes a problem that needs a practical software decision, reply to this email. I
        will tell you whether FSS is likely to be useful.
      </Text>
      <Text style={{ margin: 0 }}>
        Jean-Fidele
        <br />
        Faithful Software Solutions
      </Text>
    </FssEmailLayout>
  );
}
