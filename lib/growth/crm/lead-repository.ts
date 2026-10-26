import { CrmError } from "./errors";
import type { CaptureLead } from "./schemas";
import type { GrowthTransaction } from "../db/types";

export async function findCapture(
  tx: GrowthTransaction,
  input: CaptureLead,
  actorId: string,
): Promise<string | null> {
  if (input.inboundLeadId) {
    const [inbound] =
      await tx`select id from growth.inbound_leads where id=${input.inboundLeadId} for update`;
    if (!inbound) throw new CrmError("not_found");
  }
  await tx`select pg_advisory_xact_lock(hashtextextended(${input.requestId}, 0))`;
  const [existing] = await tx<
    { prospectId: string }[]
  >`select prospect_id as "prospectId" from growth.crm_capture_requests
    where actor_id=${actorId} and (id=${input.requestId} or inbound_lead_id=${input.inboundLeadId ?? null}::uuid) limit 1`;
  return existing?.prospectId ?? null;
}

export async function captureBusiness(
  tx: GrowthTransaction,
  input: CaptureLead,
): Promise<string> {
  // Serialize this identity even when no row yet exists. The unique index remains the final guard.
  await tx`select pg_advisory_xact_lock(hashtextextended(${input.companyNumber}, 0))`;
  const [business] = await tx<{ id: string }[]>`select id from growth.businesses
    where upper(regexp_replace(company_number,'[[:space:]]+','','g'))=${input.companyNumber} for update`;
  if (business) return business.id;
  const [created] = await tx<{ id: string }[]>`insert into growth.businesses
    (legal_name,company_number,corporate_type,corporate_status,sector,locality,county,website_url,first_party_source_url,verified_at)
    values (${input.businessName},${input.companyNumber},${input.corporateType},'uncertain',${input.sector},${input.locality},'Kent',${input.websiteUrl},${input.sourceUrl},null) returning id`;
  return created.id;
}

export async function captureContact(
  tx: GrowthTransaction,
  contact: CaptureLead["contact"],
  businessId: string,
): Promise<string | null> {
  if (!contact) return null;
  if (Date.parse(contact.verifiedAt) > Date.now())
    throw new CrmError("invalid");
  await tx`select pg_advisory_xact_lock(hashtextextended(${contact.email}, 0))`;
  const [existing] = await tx<
    { id: string; businessId: string }[]
  >`select id,business_id as "businessId" from growth.contacts where normalised_email=${contact.email} for update`;
  if (existing) {
    if (existing.businessId !== businessId) throw new CrmError("duplicate");
    return existing.id;
  }
  const [created] = await tx<{ id: string }[]>`insert into growth.contacts
    (business_id,first_name,last_name,role_title,email,email_source_url,email_verified_at,subscriber_type,lawful_basis)
    values (${businessId},${contact.firstName},${contact.lastName},${contact.roleTitle},${contact.email},${contact.sourceUrl},${contact.verifiedAt},'uncertain',${contact.lawfulBasis}) returning id`;
  return created.id;
}
