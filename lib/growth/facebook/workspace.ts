import { requireCampaignFounder } from "../campaigns/authorization";
import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import { withGrowthTransaction } from "../db/client";
import { derivePostReadiness, type RulesReview } from "./contracts";

type Destination = {
  id: string;
  url: string;
  name: string;
  kind: "page" | "group";
  locality: string | null;
  websiteUrl: string | null;
  version: number;
};
type Observation = {
  id: string;
  destinationId: string;
  sourceUrl: string;
  summary: string;
  observedAt: Date;
  createdAt: Date;
  provenance: "founder" | "signed_agent";
};
type Review = RulesReview & {
  id: string;
  destinationId: string;
  sourceUrl: string;
  summary: string;
  actorId: string;
  createdAt: Date;
  reviewedVersion: number;
};
type Activity = {
  id: string;
  destinationId: string;
  activity: "followed" | "joined" | "posted";
  occurredAt: Date;
  evidenceUrl: string | null;
  prospectId: string | null;
};
type Link = {
  destinationId: string;
  prospectId: string;
  name: string;
  version: number;
};
type Pilot = {
  slot: number;
  prospectId: string;
  businessId: string;
  name: string;
  previewStatus: string | null;
};
export type FacebookWorkspaceResult =
  | {
      status: "ready";
      destinations: Array<
        Destination & {
          observations: Observation[];
          observationsHaveMore: boolean;
          latestObservation: Observation | null;
          review: Review | null;
          postReadiness: ReturnType<typeof derivePostReadiness>;
          activities: Activity[];
          activitiesHaveMore: boolean;
          prospects: Link[];
          prospectsHaveMore: boolean;
          nextManualAction: "follow" | "join" | "review_rules" | "post";
        }
      >;
      nextCursor: string | null;
      historyLimit: 20;
      pilots: {
        total: 2;
        used: number;
        remaining: number;
        allocations: Pilot[];
      };
    }
  | { status: "error"; message: string; correlationId: string };
type JsonValue<T> = T extends Date
  ? string
  : T extends Array<infer Item>
    ? JsonValue<Item>[]
    : T extends object
      ? { [Key in keyof T]: JsonValue<T[Key]> }
      : T;
/** The HTTP representation serializes database dates as ISO strings. */
export type FacebookWorkspaceDto = JsonValue<FacebookWorkspaceResult>;
export async function getFacebookWorkspace(
  db: GrowthDb,
  founder: FounderSession,
  now: Date,
  correlationId: string,
  cursor: string | null = null,
  selectedId: string | null = null,
): Promise<FacebookWorkspaceResult> {
  requireCampaignFounder(founder);
  if (
    !correlationId.trim() ||
    Number.isNaN(now.getTime()) ||
    [cursor, selectedId].some(
      (id) =>
        id !== null &&
        !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          id,
        ),
    )
  )
    throw new Error("invalid_workspace_request");
  try {
    return await withGrowthTransaction(db, async (tx) => {
      await tx`set transaction isolation level repeatable read read only`;
      const [page, allocations] = await Promise.all([
        tx<
          Destination[]
        >`select id,url,name,kind,locality,website_url as "websiteUrl",version from growth.facebook_destinations where (${selectedId}::uuid is null and (${cursor}::uuid is null or id>${cursor}::uuid) or id=${selectedId}::uuid) order by id limit 51`,
        tx<
          Pilot[]
        >`select a.slot,a.prospect_id as "prospectId",a.business_id as "businessId",b.legal_name as name,pp.status as "previewStatus" from growth.facebook_pilot_allocations a join growth.businesses b on b.id=a.business_id left join growth.prospect_previews pp on pp.prospect_id=a.prospect_id order by a.slot`,
      ]);
      const destinations = page.slice(0, 50);
      const ids = destinations.map((item) => item.id);
      const [observations, reviews, activities, links, memberships] =
        await Promise.all([
          tx<
            Observation[]
          >`select o.id,o.destination_id as "destinationId",o.source_url as "sourceUrl",o.summary,o.observed_at as "observedAt",o.created_at as "createdAt",o.provenance from unnest(${ids}::uuid[]) d(id) cross join lateral (select * from growth.facebook_destination_observations where destination_id=d.id order by created_at desc,id desc limit 21) o order by o.created_at desc,o.id desc`,
          tx<
            Review[]
          >`select r.id,r.destination_id as "destinationId",r.source_url as "sourceUrl",r.summary,r.observed_at as "observedAt",r.expires_at as "expiresAt",r.decision,r.actor_id as "actorId",r.created_at as "createdAt",r.reviewed_version as "reviewedVersion" from unnest(${ids}::uuid[]) d(id) cross join lateral (select * from growth.facebook_rules_reviews where destination_id=d.id order by reviewed_version desc limit 1) r`,
          tx<
            Activity[]
          >`select a.id,a.destination_id as "destinationId",a.activity,a.occurred_at as "occurredAt",a.evidence_url as "evidenceUrl",a.prospect_id as "prospectId" from unnest(${ids}::uuid[]) d(id) cross join lateral (select * from growth.facebook_activities where destination_id=d.id order by occurred_at desc,id desc limit 21) a order by a.occurred_at desc,a.id desc`,
          tx<
            Link[]
          >`select l.destination_id as "destinationId",p.id as "prospectId",b.legal_name as name,p.version from unnest(${ids}::uuid[]) d(id) cross join lateral (select * from growth.facebook_destination_prospects where destination_id=d.id order by prospect_id limit 21) l join growth.prospects p on p.id=l.prospect_id join growth.businesses b on b.id=p.business_id order by l.destination_id,p.id`,
          tx<
            { destinationId: string; activity: "followed" | "joined" }[]
          >`select d.id as "destinationId", m.activity from unnest(${ids}::uuid[]) d(id) cross join lateral (select distinct activity from growth.facebook_activities a where a.destination_id=d.id and a.activity in ('followed','joined')) m`,
        ]);
      return {
        status: "ready",
        destinations: destinations.map((destination) => {
          const history = observations.filter(
            (item) => item.destinationId === destination.id,
          );
          const review =
            reviews.find((item) => item.destinationId === destination.id) ??
            null;
          const activity = activities.filter(
            (item) => item.destinationId === destination.id,
          );
          const prospects = links.filter(
            (item) => item.destinationId === destination.id,
          );
          const changed =
            review && destination.version !== review.reviewedVersion
              ? new Date(review.observedAt.getTime() + 1)
              : null;
          const postReadiness = derivePostReadiness(review, changed, now);
          const hasMembership = memberships.some(
            (item) =>
              item.destinationId === destination.id &&
              item.activity ===
                (destination.kind === "page" ? "followed" : "joined"),
          );
          return {
            ...destination,
            observations: history.slice(0, 20),
            observationsHaveMore: history.length > 20,
            latestObservation: history[0] ?? null,
            review,
            postReadiness,
            activities: activity.slice(0, 20),
            activitiesHaveMore: activity.length > 20,
            prospects: prospects.slice(0, 20),
            prospectsHaveMore: prospects.length > 20,
            nextManualAction: !hasMembership
              ? destination.kind === "page"
                ? "follow"
                : "join"
              : postReadiness === "allowed"
                ? "post"
                : "review_rules",
          };
        }),
        nextCursor:
          page.length > 50
            ? (destinations[destinations.length - 1]?.id ?? null)
            : null,
        historyLimit: 20,
        pilots: {
          total: 2,
          used: allocations.length,
          remaining: 2 - allocations.length,
          allocations,
        },
      };
    });
  } catch {
    return {
      status: "error",
      message: "Facebook workspace could not load.",
      correlationId,
    };
  }
}
