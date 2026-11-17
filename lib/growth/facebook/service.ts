import { createHash } from "node:crypto";
import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import { requireCampaignFounder } from "../campaigns/authorization";
import {
  captureSourceLead,
  normalizeSourceUrl,
} from "../campaigns/source-service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import {
  facebookCommandSchema,
  facebookDiscoveryBatchSchema,
  type FacebookCommand,
  type FacebookDiscoveryBatch,
} from "./contracts";

export type FacebookErrorCode =
  | "destination_kind_conflict"
  | "future_observation"
  | "invalid_correlation_id"
  | "request_conflict"
  | "invalid_review_time"
  | "destination_version_changed"
  | "review_insert_failed"
  | "future_activity"
  | "invalid_activity"
  | "activity_insert_failed"
  | "invalid_source"
  | "source_capture_failed"
  | "prospect_version_changed"
  | "prospect_protected"
  | "pilot_business_allocated"
  | "pilot_capacity_full"
  | "invalid_agent_identity"
  | "duplicate_destination"
  | "discovery_insert_failed";
export class FacebookError extends Error {
  constructor(readonly code: FacebookErrorCode) {
    super(code);
    this.name = "FacebookError";
  }
}
const hash = (value: unknown) =>
  createHash("sha256").update(JSON.stringify(value)).digest("hex");
type Destination = Extract<
  FacebookCommand,
  { type: "capture_destination" }
>["destination"];
async function insertObservation(
  tx: GrowthTransaction,
  destination: Destination,
  actorId: string,
  provenance: "founder" | "signed_agent",
  runId: string | null,
): Promise<string> {
  const url = normalizeSourceUrl(destination.url);
  const [row] = await tx<
    { id: string; kind: string }[]
  >`insert into growth.facebook_destinations(url,name,kind,locality,website_url) values (${url},${destination.name},${destination.kind},${destination.locality},${destination.websiteUrl}) on conflict(url) do update set version=growth.facebook_destinations.version+1 returning id,kind`;
  if (!row || row.kind !== destination.kind)
    throw new FacebookError("destination_kind_conflict");
  await tx`insert into growth.facebook_destination_observations(destination_id,discovery_run_id,source_url,summary,observed_at,provenance,actor_id) values (${row.id},${runId},${destination.observation.sourceUrl},${destination.observation.summary},${destination.observation.observedAt},${provenance},${actorId})`;
  return row.id;
}
function validateObservation(destination: Destination, now: Date): void {
  if (destination.observation.observedAt > now)
    throw new FacebookError("future_observation");
}
async function audit(
  tx: GrowthTransaction,
  actorType: "founder" | "agent",
  actorId: string,
  correlationId: string,
  action: string,
  id: string,
): Promise<void> {
  await appendAuditEvent(tx, {
    actorType,
    actorId,
    correlationId,
    action,
    entityType: "facebook",
    entityId: id,
  });
}
export async function executeFacebookCommand(
  db: GrowthDb,
  raw: FacebookCommand,
  founder: FounderSession,
  correlationId: string,
): Promise<{ id: string; alreadyExisted: boolean }> {
  const command = facebookCommandSchema.parse(raw);
  requireCampaignFounder(founder);
  if (!correlationId.trim()) throw new FacebookError("invalid_correlation_id");
  const requestHash = hash(command);
  return withGrowthTransaction(db, async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:facebook-command:${command.requestId}`},0))`;
    const [previous] = await tx<
      { id: string; hash: string; actor: string }[]
    >`select result_id as id,request_hash as hash,actor_id as actor from growth.facebook_command_requests where request_id=${command.requestId}`;
    if (previous) {
      if (previous.hash !== requestHash || previous.actor !== founder.actorId)
        throw new FacebookError("request_conflict");
      return { id: previous.id, alreadyExisted: true };
    }
    const now = new Date();
    let id: string;
    switch (command.type) {
      case "capture_destination":
        validateObservation(command.destination, now);
        id = await insertObservation(
          tx,
          command.destination,
          founder.actorId,
          "founder",
          null,
        );
        break;
      case "review_rules": {
        if (
          command.observedAt > now ||
          command.expiresAt <= now ||
          command.expiresAt.getTime() >
            command.observedAt.getTime() + 30 * 86400000
        )
          throw new FacebookError("invalid_review_time");
        const [updated] = await tx<
          { id: string }[]
        >`update growth.facebook_destinations set version=version+1 where id=${command.destinationId} and version=${command.expectedVersion} returning id`;
        if (!updated) throw new FacebookError("destination_version_changed");
        const [review] = await tx<
          { id: string }[]
        >`insert into growth.facebook_rules_reviews(destination_id,source_url,summary,observed_at,expires_at,decision,actor_id,reviewed_version) values (${command.destinationId},${command.sourceUrl},${command.summary},${command.observedAt},${command.expiresAt},${command.decision},${founder.actorId},${command.expectedVersion + 1}) returning id`;
        if (!review) throw new FacebookError("review_insert_failed");
        id = review.id;
        break;
      }
      case "record_activity": {
        if (command.occurredAt > now)
          throw new FacebookError("future_activity");
        const [destination] = await tx<
          { kind: string }[]
        >`select kind from growth.facebook_destinations where id=${command.destinationId}`;
        if (
          !destination ||
          (command.activity === "followed" && destination.kind !== "page") ||
          (command.activity === "joined" && destination.kind !== "group")
        )
          throw new FacebookError("invalid_activity");
        const [activity] = await tx<
          { id: string }[]
        >`insert into growth.facebook_activities(destination_id,activity,occurred_at,actor_id,evidence_url,prospect_id) values (${command.destinationId},${command.activity},${command.occurredAt},${founder.actorId},${command.evidenceUrl},${command.prospectId}) returning id`;
        if (!activity) throw new FacebookError("activity_insert_failed");
        id = activity.id;
        break;
      }
      case "capture_source": {
        const [dest] = await tx<
          { kind: string; url: string }[]
        >`select kind,url from growth.facebook_destinations where id=${command.destinationId}`;
        if (
          !dest ||
          command.source.sourceType !== `facebook_${dest.kind}` ||
          command.source.requestId !== command.requestId
        )
          throw new FacebookError("invalid_source");
        const [used] =
          await tx`select 1 from growth.crm_capture_requests where id=${command.source.requestId}`;
        if (used) throw new FacebookError("request_conflict");
        const result = await captureSourceLead(
          tx,
          command.source,
          founder,
          correlationId,
        );
        if (!result.prospectId)
          throw new FacebookError("source_capture_failed");
        id = result.prospectId;
        await tx`insert into growth.facebook_destination_prospects(destination_id,prospect_id) values (${command.destinationId},${id}) on conflict do nothing`;
        break;
      }
      case "link_prospect":
        id = command.prospectId;
        await tx`insert into growth.facebook_destination_prospects(destination_id,prospect_id) values (${command.destinationId},${id}) on conflict do nothing`;
        break;
      case "allocate_pilot": {
        await tx`select pg_advisory_xact_lock(hashtextextended('growth:facebook-pilot-allocation',0))`;
        const [prospect] = await tx<
          { businessId: string; version: number; protected: boolean }[]
        >`select p.business_id as "businessId",p.version, (growth.is_outreach_client(p.id) or exists(select 1 from growth.suppressions s where s.business_id=p.business_id or s.normalised_email=lower(trim(p.source_details->>'email')) or exists(select 1 from growth.contacts c where c.business_id=p.business_id and c.normalised_email=s.normalised_email))) as protected from growth.prospects p where p.id=${command.prospectId} for update`;
        if (!prospect || prospect.version !== command.expectedVersion)
          throw new FacebookError("prospect_version_changed");
        if (prospect.protected) throw new FacebookError("prospect_protected");
        const [existingBusiness] =
          await tx`select slot from growth.facebook_pilot_allocations where business_id=${prospect.businessId}`;
        if (existingBusiness)
          throw new FacebookError("pilot_business_allocated");
        const [allocation] = await tx<
          { slot: number }[]
        >`insert into growth.facebook_pilot_allocations(slot,business_id,prospect_id,actor_id) select s.slot,${prospect.businessId},${command.prospectId},${founder.actorId} from (values (1::smallint),(2::smallint)) s(slot) where not exists(select 1 from growth.facebook_pilot_allocations a where a.slot=s.slot) order by s.slot limit 1 returning slot`;
        if (!allocation) throw new FacebookError("pilot_capacity_full");
        id = command.prospectId;
        break;
      }
    }
    await tx`insert into growth.facebook_command_requests(request_id,request_hash,actor_id,result_id) values (${command.requestId},${requestHash},${founder.actorId},${id})`;
    await audit(
      tx,
      "founder",
      founder.actorId,
      correlationId,
      `facebook.${command.type}`,
      id,
    );
    return { id, alreadyExisted: false };
  });
}
export async function ingestFacebookDiscovery(
  db: GrowthDb,
  raw: FacebookDiscoveryBatch,
  agentId: string,
  correlationId: string,
): Promise<{ count: number; alreadyExisted: boolean }> {
  const batch = facebookDiscoveryBatchSchema.parse(raw);
  if (!agentId.trim() || agentId.length > 200 || !correlationId.trim())
    throw new FacebookError("invalid_agent_identity");
  if (batch.observedAt > new Date())
    throw new FacebookError("future_observation");
  for (const destination of batch.observations)
    validateObservation(destination, new Date());
  const urls = batch.observations.map((item) => normalizeSourceUrl(item.url));
  if (new Set(urls).size !== urls.length)
    throw new FacebookError("duplicate_destination");
  const requestHash = hash({
    ...batch,
    observations: batch.observations.map((item) => ({
      ...item,
      url: normalizeSourceUrl(item.url),
    })),
  });
  return withGrowthTransaction(db, async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:facebook-discovery:${batch.externalRunId}`},0))`;
    const [previous] = await tx<
      { id: string; hash: string; actor: string; count: number }[]
    >`select id,request_hash as hash,agent_id as actor,observation_count as count from growth.facebook_discovery_runs where external_run_id=${batch.externalRunId}`;
    if (previous) {
      if (previous.hash !== requestHash || previous.actor !== agentId)
        throw new FacebookError("request_conflict");
      return { count: previous.count, alreadyExisted: true };
    }
    const [run] = await tx<
      { id: string }[]
    >`insert into growth.facebook_discovery_runs(external_run_id,request_hash,agent_id,observed_at,observation_count) values (${batch.externalRunId},${requestHash},${agentId},${batch.observedAt},${batch.observations.length}) returning id`;
    if (!run) throw new FacebookError("discovery_insert_failed");
    for (const destination of batch.observations)
      await insertObservation(tx, destination, agentId, "signed_agent", run.id);
    await audit(
      tx,
      "agent",
      agentId,
      correlationId,
      "facebook.discovery",
      run.id,
    );
    return { count: batch.observations.length, alreadyExisted: false };
  });
}
