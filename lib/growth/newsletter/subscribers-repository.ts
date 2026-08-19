import type { GrowthQueryExecutor } from "../db/types";
import type { NewsletterSubscriberDependencies, NewsletterSubscriberRecord } from "./subscribers";

/** Genuine upsert for a Resend bounce/complaint webhook: unlike
 * `updateSubscriberStatus`, this must work for an email that has never
 * been a newsletter subscriber (a cold prospect or one-off lead). */
export async function upsertSuppressedStatus(
  db: GrowthQueryExecutor,
  normalisedEmail: string,
  status: "bounced" | "complained",
  at: Date,
): Promise<void> {
  await db`
    insert into growth.newsletter_subscribers (email, status, unsubscribed_at)
    values (${normalisedEmail}, ${status}, ${at})
    on conflict (normalised_email) do update
      set status = excluded.status, unsubscribed_at = excluded.unsubscribed_at, updated_at = now()
  `;
}

type Row = {
  id: string;
  normalisedEmail: string;
  status: NewsletterSubscriberRecord["status"];
  consentedAt: Date | null;
  unsubscribedAt: Date | null;
};

export function createNewsletterSubscriberRepository(
  db: GrowthQueryExecutor,
): NewsletterSubscriberDependencies {
  return {
    async findSubscriberByEmail(normalisedEmail) {
      const rows = await db<Row[]>`
        select id, normalised_email as "normalisedEmail", status,
               consented_at as "consentedAt", unsubscribed_at as "unsubscribedAt"
        from growth.newsletter_subscribers
        where normalised_email = ${normalisedEmail}
      `;
      return rows[0] ?? null;
    },
    async insertSubscriber(input) {
      const [row] = await db<Row[]>`
        insert into growth.newsletter_subscribers (
          email, first_name, business_name, status,
          consent_source, consent_text_version, consent_evidence,
          consent_ip_hash, consent_user_agent_hash, consented_at
        ) values (
          ${input.email}, ${input.firstName ?? null}, ${input.businessName ?? null}, 'subscribed',
          ${input.consentSource}, ${input.consentTextVersion}, ${input.consentEvidence},
          ${input.consentIpHash ?? null}, ${input.consentUserAgentHash ?? null}, ${input.consentedAt}
        )
        returning id, normalised_email as "normalisedEmail", status,
                  consented_at as "consentedAt", unsubscribed_at as "unsubscribedAt"
      `;
      return row;
    },
    async updateSubscriberConsent(id, input) {
      const [row] = await db<Row[]>`
        update growth.newsletter_subscribers
        set status = 'subscribed',
            first_name = coalesce(${input.firstName ?? null}, first_name),
            business_name = coalesce(${input.businessName ?? null}, business_name),
            consent_source = ${input.consentSource},
            consent_text_version = ${input.consentTextVersion},
            consent_evidence = ${input.consentEvidence},
            consent_ip_hash = ${input.consentIpHash ?? null},
            consent_user_agent_hash = ${input.consentUserAgentHash ?? null},
            consented_at = ${input.consentedAt},
            unsubscribed_at = null,
            updated_at = now()
        where id = ${id}
        returning id, normalised_email as "normalisedEmail", status,
                  consented_at as "consentedAt", unsubscribed_at as "unsubscribedAt"
      `;
      return row;
    },
    async updateSubscriberStatus(id, status, at) {
      const [row] = await db<Row[]>`
        update growth.newsletter_subscribers
        set status = ${status}, unsubscribed_at = ${at}, updated_at = now()
        where id = ${id}
        returning id, normalised_email as "normalisedEmail", status,
                  consented_at as "consentedAt", unsubscribed_at as "unsubscribedAt"
      `;
      return row;
    },
  };
}
