import { Text } from "@react-email/components";

import { FssEmailLayout } from "./components/fss-email-layout";
import { emailColors } from "./styles";

export const NEWSLETTER_WELCOME_SUBJECT = "Welcome to FSS Field Notes";
export const NEWSLETTER_WELCOME_PREVIEW =
  "Practical notes on software, automation and better operating systems.";

export type NewsletterWelcomeProps = {
  firstName: string;
  unsubscribeUrl: string;
  postalAddress: string;
};

const listItemStyle = { margin: "0 0 4px" };

function requireMergeValue(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new TypeError(`Newsletter welcome requires a ${field}.`);
  }
  return trimmed;
}

export function NewsletterWelcome(props: NewsletterWelcomeProps) {
  const firstName = requireMergeValue(props.firstName, "first name");
  const postalAddress = requireMergeValue(props.postalAddress, "postal address");
  const unsubscribeUrl = requireMergeValue(props.unsubscribeUrl, "unsubscribe URL");

  return (
    <FssEmailLayout
      category="newsletter"
      previewText={NEWSLETTER_WELCOME_PREVIEW}
      title={NEWSLETTER_WELCOME_SUBJECT}
      unsubscribeUrl={unsubscribeUrl}
    >
      <Text>Hi {firstName},</Text>
      <Text>You are now subscribed to FSS Field Notes.</Text>
      <Text>
        This is a practical email for founders and teams who need their systems to carry more of the
        work. Each issue takes one operational problem and explains the smallest useful way to improve
        it.
      </Text>
      <Text style={{ margin: "0 0 4px" }}>You can expect:</Text>
      <Text style={listItemStyle}>1. clear examples of where a process breaks;</Text>
      <Text style={listItemStyle}>2. grounded uses of software and automation;</Text>
      <Text style={{ margin: 0 }}>3. direct advice on what not to build yet.</Text>
      <Text>
        The aim is not to add another tool. It is to help you decide where a better system would remove
        repeated work, protect service quality and give the team a clearer view of what happens next.
      </Text>
      <Text>
        If there is one process you want me to examine in a future issue, reply and tell me where it
        breaks. I read every response.
      </Text>
      <Text style={{ margin: 0 }}>
        Jean-Fidele
        <br />
        Faithful Software Solutions
      </Text>
      <Text style={{ fontSize: 12, color: emailColors.textMuted, margin: "8px 0 0" }}>
        {postalAddress}
      </Text>
    </FssEmailLayout>
  );
}
