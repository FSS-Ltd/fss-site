import { randomUUID } from "node:crypto";
import type { OperationsDb } from "../../../lib/operations/db/client";

export async function createEngagement(db: OperationsDb): Promise<{
  engagementId: string;
  prospectId: string;
  businessId: string;
  contactId: string;
}> {
  const suffix = randomUUID();
  const [business] = await db<{ id: string }[]>`
    insert into growth.businesses (legal_name, corporate_type, corporate_status, sector, locality, county, first_party_source_url, verified_at)
    values (${`Operations fixture ${suffix}`}, 'limited_company', 'active', 'Technology', 'Canterbury', 'Kent', 'https://example.test', now()) returning id
  `;
  const [contact] = await db<{ id: string }[]>`
    insert into growth.contacts (business_id, first_name, last_name, email, email_source_url, email_verified_at, subscriber_type, lawful_basis)
    values (${business.id}, 'Test', 'Contact', ${`${suffix}@example.test`}, 'https://example.test', now(), 'corporate', 'legitimate_interests') returning id
  `;
  const [prospect] = await db<{ id: string }[]>`
    insert into growth.prospects (business_id, primary_contact_id, fit_score, opportunity_summary, recommended_offer, estimated_one_off_min_pence, estimated_one_off_max_pence, assigned_owner_email)
    values (${business.id}, ${contact.id}, 80, 'Test', 'Test', 100, 200, 'j.ntagengwa@faithfulsoftware.dev') returning id
  `;
  const [engagement] = await db<
    { id: string }[]
  >`insert into growth.delivery_engagements (prospect_id, name) values (${prospect.id}, 'Test') returning id`;
  return {
    engagementId: engagement.id,
    prospectId: prospect.id,
    businessId: business.id,
    contactId: contact.id,
  };
}
