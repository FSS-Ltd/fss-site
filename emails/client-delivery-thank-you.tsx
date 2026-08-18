import { Text } from "@react-email/components";

import { FssEmailLayout } from "./components/fss-email-layout";
import type { FssEmailImageProps } from "./components/email-image";

export const CLIENT_DELIVERY_THANK_YOU_PREVIEW =
  "Your handover is complete. Here is how to keep the work useful.";

export type ClientDeliveryThankYouProps = {
  firstName: string;
  engagementName: string;
  newsletterOptInUrl?: string;
  image?: FssEmailImageProps;
};

const listItemStyle = { margin: "0 0 4px" };

function requireMergeValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TypeError(`Client delivery thank-you requires a ${field}.`);
  }
  return trimmed;
}

function subjectFor(engagementName: string): string {
  return `Thank you for trusting FSS with ${engagementName}`;
}

export function clientDeliveryThankYouSubject(engagementName: string): string {
  return subjectFor(requireMergeValue(engagementName, "engagement name"));
}

export function ClientDeliveryThankYou(props: ClientDeliveryThankYouProps) {
  const firstName = requireMergeValue(props.firstName, "first name");
  const engagementName = requireMergeValue(props.engagementName, "engagement name");
  const newsletterOptInUrl = props.newsletterOptInUrl?.trim() || undefined;

  return (
    <FssEmailLayout
      category="transactional"
      previewText={CLIENT_DELIVERY_THANK_YOU_PREVIEW}
      title={subjectFor(engagementName)}
      image={props.image}
    >
      <Text>Hi {firstName},</Text>
      <Text>
        Thank you for trusting Faithful Software Solutions with {engagementName}.
      </Text>
      <Text>
        The handover marks the end of the build, but the useful result is what happens next. Keep the
        owner clear, review the process while it is still familiar, and tell me early if the system stops
        matching the way the team works.
      </Text>
      <Text style={{ margin: "0 0 4px" }}>Three things are worth keeping:</Text>
      <Text style={listItemStyle}>1. one named owner for the process;</Text>
      <Text style={listItemStyle}>2. a short review after the first month;</Text>
      <Text style={{ margin: 0 }}>
        3. a direct route for reporting friction before it becomes a workaround.
      </Text>
      <Text>
        You can reply to this email whenever a practical question appears. I would rather help you protect
        a useful system than let a small problem become repeated work.
      </Text>
      {newsletterOptInUrl ? (
        <>
          <Text>
            If you would like occasional notes on software, automation and better operating systems, you
            can choose to join FSS Field Notes here: {newsletterOptInUrl}
          </Text>
          <Text>The newsletter is optional. This email has not subscribed you.</Text>
        </>
      ) : null}
      <Text style={{ margin: 0 }}>
        Jean-Fidele
        <br />
        Faithful Software Solutions
      </Text>
    </FssEmailLayout>
  );
}
