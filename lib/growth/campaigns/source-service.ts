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

function normalizeSourceUrl(value: string): string {
  const url = new URL(value);
  if (
    url.hostname === "facebook.com" ||
    url.hostname.endsWith(".facebook.com")
  ) {
    url.protocol = "https:";
    url.hostname = "facebook.com";
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    for (const key of [...url.searchParams.keys()]) {
      if (
        key.toLowerCase().startsWith("utm_") ||
        ["fbclid", "ref", "refsrc", "mibextid"].includes(key.toLowerCase())
      )
        url.searchParams.delete(key);
    }
    url.searchParams.sort();
    url.hash = "";
  }
  return url.toString();
}

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
  const sourceUrl = normalizeSourceUrl(input.sourceUrl);
  const host = businessWebsiteHost(sourceUrl);
  const keys = [`growth:source:${sourceUrl}`, input.requestId];
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
  const sourcePath = new URL(sourceUrl).pathname.replace(/\/+$/, "");
  const sourceCandidates = await tx<
    {
      id: string;
      businessId: string;
      name: string;
      country: string;
      sourceUrl: string;
    }[]
  >`
    select p.id, b.id as "businessId", b.legal_name as name, b.country_code as country, p.source_url as "sourceUrl"
    from growth.prospects p join growth.businesses b on b.id=p.business_id
    where p.source_url=${sourceUrl} or (${input.sourceType.startsWith("facebook_")} and p.source_type in ('facebook_page','facebook_group')
      and regexp_replace(split_part(regexp_replace(p.source_url, '^https?://(www[.]|m[.])?facebook[.]com', '', 'i'), '?', 1), '/+$', '')=${sourcePath})`;
  const sourceMatches = sourceCandidates.filter(
    (row) =>
      normalizeSourceUrl(row.sourceUrl) === sourceUrl &&
      (input.sourceType !== "facebook_group" ||
        (row.name.trim().toLowerCase() ===
          input.businessName.trim().toLowerCase() &&
          row.country === input.countryCode)),
  );
  const businesses = await tx<{ id: string; name: string }[]>`
    select b.id, b.legal_name as name from growth.businesses b where
      (${registration}::text is not null and b.country_code=${input.countryCode} and (upper(regexp_replace(b.company_number,'[[:space:]]+','','g'))=${registration} or exists (select 1 from growth.prospects p where p.business_id=b.id and upper(regexp_replace(p.source_details->>'registrationNumber','[[:space:]]+','','g'))=${registration})))
      or (${host}::text is not null and substring(lower(coalesce(b.website_url,b.first_party_source_url)) from '^https?://(?:www[.])?([^/:?#]+)')=${host})`;
  const identities = new Map(businesses.map((row) => [row.id, row.name]));
  for (const row of sourceMatches) identities.set(row.businessId, row.name);
  if (identities.size > 1) throw new CrmError("duplicate");
  let businessId = identities.keys().next().value;
  if (businessId) {
    if (
      identities.get(businessId)?.trim().toLowerCase() !==
      input.businessName.trim().toLowerCase()
    )
      throw new CrmError("duplicate");
    const prospects = await tx<
      { id: string }[]
    >`select id from growth.prospects where business_id=${businessId} order by created_at desc limit 2`;
    if (prospects.length > 1) throw new CrmError("duplicate");
    if (prospects[0]) {
      await tx`insert into growth.crm_capture_requests (id,prospect_id,actor_id) values (${input.requestId},${prospects[0].id},${founder.actorId})`;
      return { prospectId: prospects[0].id, alreadyExisted: true };
    }
  } else {
    const [business] = await tx<
      { id: string }[]
    >`insert into growth.businesses (legal_name,company_number,country_code,corporate_type,corporate_status,sector,locality,county,website_url,first_party_source_url,verified_at)
      values (${input.businessName.trim()},null,${input.countryCode},'unknown','uncertain','Unclassified','Not provided',null,null,${sourceUrl},null) returning id`;
    if (!business) throw new Error("Business insert returned no row.");
    businessId = business.id;
  }
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
    values (${businessId},'needs_review',0,${input.opportunity},${input.offer},0,0,0,${founder.email},${input.sourceType},${sourceUrl},${input.observedAt},${tx.json(details)}) returning id`;
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
