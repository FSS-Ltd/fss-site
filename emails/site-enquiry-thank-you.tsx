import { Text } from "@react-email/components";

import { FssEmailLayout } from "./components/fss-email-layout";
import type { FssEmailImageProps } from "./components/email-image";

export const SITE_ENQUIRY_THANK_YOU_SUBJECT = "We received your request";
export const SITE_ENQUIRY_THANK_YOU_PREVIEW = "Your request is with FSS. Here is what happens next.";

export type SiteEnquiryThankYouProps = {
  firstName: string;
  businessName: string;
  image?: FssEmailImageProps;
};

const listItemStyle = { margin: "0 0 4px" };

function requireMergeValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TypeError(`Site enquiry thank-you requires a ${field}.`);
  }
  return trimmed;
}

export function SiteEnquiryThankYou(props: SiteEnquiryThankYouProps) {
  const firstName = requireMergeValue(props.firstName, "first name");
  const businessName = requireMergeValue(props.businessName, "business name");

  return (
    <FssEmailLayout
      category="transactional"
      previewText={SITE_ENQUIRY_THANK_YOU_PREVIEW}
      title={SITE_ENQUIRY_THANK_YOU_SUBJECT}
      image={props.image}
    >
      <Text>Hi {firstName},</Text>
      <Text>Thank you for telling us about the enquiry process at {businessName}.</Text>
      <Text>
        I will review what you shared and look for the point where the current process creates the most
        unnecessary work. You will receive a personal response within two working days.
      </Text>
      <Text style={{ fontWeight: 700, margin: "0 0 4px" }}>What happens next</Text>
      <Text style={listItemStyle}>1. I read your answers and check the current journey.</Text>
      <Text style={listItemStyle}>2. I identify the smallest useful improvement.</Text>
      <Text style={{ margin: 0 }}>
        3. If FSS can help, I will suggest a short conversation with a clear agenda.
      </Text>
      <Text>
        There is nothing else you need to prepare. If another detail would help, reply directly to this
        email.
      </Text>
      <Text style={{ margin: 0 }}>
        Jean-Fidele
        <br />
        Faithful Software Solutions
      </Text>
    </FssEmailLayout>
  );
}
