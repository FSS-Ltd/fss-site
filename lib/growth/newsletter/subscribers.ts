export type NewsletterSubscriberStatus =
  | "pending"
  | "subscribed"
  | "unsubscribed"
  | "bounced"
  | "complained";

export type NewsletterSubscriberRecord = {
  id: string;
  normalisedEmail: string;
  status: NewsletterSubscriberStatus;
  consentedAt: Date | null;
  unsubscribedAt: Date | null;
};

export type NewsletterConsentInput = {
  email: string;
  firstName?: string;
  businessName?: string;
  consentSource: string;
  consentTextVersion: string;
  consentEvidence: string;
  consentIpHash?: string;
  consentUserAgentHash?: string;
  consentedAt: Date;
};

export type NewsletterSubscriberDependencies = {
  findSubscriberByEmail: (normalisedEmail: string) => Promise<NewsletterSubscriberRecord | null>;
  insertSubscriber: (
    input: NewsletterConsentInput & { normalisedEmail: string },
  ) => Promise<NewsletterSubscriberRecord>;
  updateSubscriberConsent: (
    id: string,
    input: NewsletterConsentInput,
  ) => Promise<NewsletterSubscriberRecord>;
  updateSubscriberStatus: (
    id: string,
    status: "unsubscribed",
    at: Date,
  ) => Promise<NewsletterSubscriberRecord>;
};

export class NewsletterConsentError extends Error {
  constructor(
    public readonly code: "already_suppressed" | "stale_consent" | "invalid_input",
    message: string,
  ) {
    super(message);
    this.name = "NewsletterConsentError";
  }
}

export function normaliseNewsletterEmail(email: string): string {
  return email.trim().toLowerCase();
}

function requireNonEmpty(value: string, field: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new NewsletterConsentError("invalid_input", `Newsletter opt-in requires ${field}.`);
  }
  return trimmed;
}

/**
 * Records an explicit newsletter opt-in. Never call this from a contact form,
 * resource request, or cold prospect record — consent must come from the
 * subscriber's own action on a dedicated opt-in surface.
 */
export async function recordNewsletterOptIn(
  input: NewsletterConsentInput,
  dependencies: NewsletterSubscriberDependencies,
): Promise<NewsletterSubscriberRecord> {
  requireNonEmpty(input.email, "an email address");
  requireNonEmpty(input.consentSource, "a consent source");
  requireNonEmpty(input.consentTextVersion, "a consent text version");
  requireNonEmpty(input.consentEvidence, "consent evidence");

  const normalisedEmail = normaliseNewsletterEmail(input.email);
  const existing = await dependencies.findSubscriberByEmail(normalisedEmail);

  if (!existing) {
    return dependencies.insertSubscriber({ ...input, normalisedEmail });
  }

  if (existing.status === "bounced" || existing.status === "complained") {
    throw new NewsletterConsentError(
      "already_suppressed",
      "This address cannot be resubscribed because it was suppressed after a bounce or complaint.",
    );
  }

  if (
    existing.status === "unsubscribed" &&
    existing.consentedAt &&
    input.consentedAt.getTime() <= existing.consentedAt.getTime()
  ) {
    throw new NewsletterConsentError(
      "stale_consent",
      "Resubscribing requires new consent evidence recorded after the previous unsubscribe.",
    );
  }

  return dependencies.updateSubscriberConsent(existing.id, input);
}

/**
 * Records an unsubscribe. Idempotent: unknown addresses, and addresses that
 * are already unsubscribed, bounced, or complained, are all safe no-ops.
 */
export async function recordNewsletterUnsubscribe(
  email: string,
  dependencies: NewsletterSubscriberDependencies,
  now: Date = new Date(),
): Promise<NewsletterSubscriberRecord | null> {
  const existing = await dependencies.findSubscriberByEmail(normaliseNewsletterEmail(email));
  if (!existing || (existing.status !== "subscribed" && existing.status !== "pending")) {
    return existing;
  }
  return dependencies.updateSubscriberStatus(existing.id, "unsubscribed", now);
}
