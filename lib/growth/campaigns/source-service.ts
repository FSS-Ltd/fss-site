import { createHash } from "node:crypto";

import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import { CrmError } from "../crm/errors";
import type { CrmCommandResult } from "../crm/schemas";
import type { GrowthTransaction } from "../db/types";
import {
  businessWebsiteHost,
  normalizeRegistration,
} from "../research/global-identity";
import { sourceLeadInputSchema, type SourceLeadInput } from "./schemas";

export async function captureSourceLead(
  tx: GrowthTransaction,
  raw: SourceLeadInput,
  founder: FounderSession,
  correlationId: string,
): Promise<CrmCommandResult> {
  const input = sourceLeadInputSchema.parse(raw);
  if (
    founder.actorId !==
      createHash("sha256").update(founder.email).digest("hex") ||
    founder.email !== "j.ntagengwa@faithfulsoftware.dev" ||
    input.observedAt.getTime() > Date.now()
  )
    throw new CrmError("invalid");
  const hostname = new URL(input.sourceUrl).hostname.toLowerCase();
  if (
    [".internal", ".localhost", ".local", ".test"].some((suffix) =>
      hostname.endsWith(suffix),
    )
  )
    throw new CrmError("invalid");
  if (
    ![input.businessName, input.opportunity, input.offer].every(
      (value) => value.trim().length > 0,
    )
  )
    throw new CrmError("invalid");
  const registration = normalizeRegistration(
    input.registrationNumber?.trim() || null,
  );
  const host = businessWebsiteHost(input.sourceUrl);
  const keys = [`growth:source:${input.sourceUrl}`, input.requestId];
  if (registration)
    keys.push(
      input.countryCode === "GB"
        ? `growth:business:${registration}`
        : `growth:business:${input.countryCode}:${registration}`,
    );
  if (host) keys.push(`growth:website:${host}`);
  for (const key of keys.sort())
    await tx`select pg_advisory_xact_lock(hashtextextended(${key}, 0))`;
  const [previous] = await tx<
    { prospectId: string }[]
  >`select prospect_id as "prospectId" from growth.crm_capture_requests where id=${input.requestId} and actor_id=${founder.actorId}`;
  if (previous)
    return { prospectId: previous.prospectId, alreadyExisted: true };
  const matches = await tx<{ id: string; businessId: string; name: string }[]>`
    select distinct p.id, b.id as "businessId", b.legal_name as name from growth.prospects p
    join growth.businesses b on b.id=p.business_id
    where (p.source_url=${input.sourceUrl} and (${input.sourceType} <> 'facebook_group' or (lower(trim(b.legal_name))=lower(trim(${input.businessName})) and b.country_code=${input.countryCode})))
      or (${registration}::text is not null and b.country_code=${input.countryCode} and (upper(regexp_replace(b.company_number,'[[:space:]]+','','g'))=${registration} or upper(regexp_replace(p.source_details->>'registrationNumber','[[:space:]]+','','g'))=${registration}))
      or (${host}::text is not null and substring(lower(coalesce(b.website_url,b.first_party_source_url)) from '^https?://(?:www[.])?([^/:?#]+)')=${host})`;
  if (matches.length) {
    if (
      matches.length !== 1 ||
      matches[0]!.name.trim().toLowerCase() !==
        input.businessName.trim().toLowerCase()
    )
      throw new CrmError("duplicate");
    await tx`insert into growth.crm_capture_requests (id,prospect_id,actor_id) values (${input.requestId},${matches[0]!.id},${founder.actorId})`;
    return { prospectId: matches[0]!.id, alreadyExisted: true };
  }
  const [business] = await tx<
    { id: string }[]
  >`insert into growth.businesses (legal_name,company_number,country_code,corporate_type,corporate_status,sector,locality,county,website_url,first_party_source_url,verified_at)
    values (${input.businessName.trim()},null,${input.countryCode},'unknown','uncertain','Unclassified','Not provided',null,null,${input.sourceUrl},null) returning id`;
  if (!business) throw new Error("Business insert returned no row.");
  const details = {
    corporateType: input.corporateType,
    registrationNumber: registration,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
  };
  const [prospect] = await tx<
    { id: string }[]
  >`insert into growth.prospects (business_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,estimated_monthly_pence,assigned_owner_email,source_type,source_url,source_observed_at,source_details)
    values (${business.id},'needs_review',0,${input.opportunity},${input.offer},0,0,0,${founder.email},${input.sourceType},${input.sourceUrl},${input.observedAt},${tx.json(details)}) returning id`;
  if (!prospect) throw new Error("Prospect insert returned no row.");
  await tx`insert into growth.crm_capture_requests (id,prospect_id,actor_id) values (${input.requestId},${prospect.id},${founder.actorId})`;
  await appendAuditEvent(tx, {
    correlationId,
    actorType: "founder",
    actorId: founder.actorId,
    action: "crm.capture_source",
    entityType: "prospect",
    entityId: prospect.id,
  });
  return { prospectId: prospect.id };
}
