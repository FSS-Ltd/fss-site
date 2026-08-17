import type { GrowthQueryExecutor } from "../types";

export type SubscriberType = "corporate" | "individual" | "uncertain";
export type LawfulBasis =
  | "legitimate_interests"
  | "consent"
  | "contract"
  | "requested_service";

export type ContactIdentity = {
  id: string;
  businessId: string;
  email: string;
  subscriberType: SubscriberType;
  lawfulBasis: LawfulBasis;
  version: number;
};

export async function findContactIdentityByEmail(
  db: GrowthQueryExecutor,
  email: string,
): Promise<ContactIdentity | null> {
  const normalisedEmail = email.trim().toLowerCase();
  const rows = await db<ContactIdentity[]>`
    select
      c.id,
      c.business_id as "businessId",
      c.email,
      c.subscriber_type as "subscriberType",
      c.lawful_basis as "lawfulBasis",
      c.version
    from growth.contacts c
    where c.normalised_email = ${normalisedEmail}
    limit 1
  `;

  return rows[0] ?? null;
}
