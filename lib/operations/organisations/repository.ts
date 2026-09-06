import { z } from "zod";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import {
  parseReviewedMapping,
  requireOperationsFounder,
} from "./link-engagement";
import type {
  MappingResult,
  OperationsFounder,
  OrganisationPage,
} from "./types";

export class OrganisationMappingConflict extends Error {
  constructor() {
    super(
      "The reviewed mapping conflicts with the existing register. Review the organisation and engagement IDs.",
    );
  }
}

async function setFounder(
  transaction: OperationsTransaction,
  founder: OperationsFounder,
): Promise<void> {
  await transaction`select set_config('operations.actor_id', ${founder.actorId}, true)`;
}

export async function applyReviewedMapping(
  db: OperationsDb,
  context: OperationsFounder | null,
  input: unknown,
): Promise<MappingResult> {
  const founder = requireOperationsFounder(context);
  const mapping = parseReviewedMapping(input);
  const result = await db.begin(async (tx) => {
    await setFounder(tx, founder);
    let organisationsCreated = 0;
    let engagementsLinked = 0;
    // Stable organisation ordering reduces lock contention for overlapping reviews.
    for (const organisation of [...mapping.organisations].sort((a, b) =>
      a.id.localeCompare(b.id),
    )) {
      const created = await tx`
        insert into operations.organisations (id, legal_name, display_name, trading_status, timezone, created_by, review_reference)
        values (${organisation.id}, ${organisation.legalName}, ${organisation.displayName}, ${organisation.tradingStatus}, ${organisation.timezone}, ${founder.actorId}, ${mapping.reviewReference})
        on conflict (id) do nothing returning id
      `;
      organisationsCreated += created.length;
      const [existing] = await tx<{ matches: boolean }[]>`
        select legal_name = ${organisation.legalName} and display_name = ${organisation.displayName}
          and trading_status = ${organisation.tradingStatus} and timezone = ${organisation.timezone}
          and lifecycle = 'active' as matches
        from operations.organisations where id = ${organisation.id}
      `;
      if (!existing?.matches) throw new OrganisationMappingConflict();
      for (const engagementId of [...organisation.engagementIds].sort()) {
        const linked = await tx`
          insert into operations.engagement_links (organisation_id, engagement_id, created_by, review_reference)
          values (${organisation.id}, ${engagementId}, ${founder.actorId}, ${mapping.reviewReference})
          on conflict (engagement_id) do nothing returning engagement_id
        `;
        const [link] = await tx<{ organisationId: string }[]>`
          select organisation_id as "organisationId" from operations.engagement_links where engagement_id = ${engagementId}
        `;
        if (link?.organisationId !== organisation.id)
          throw new OrganisationMappingConflict();
        engagementsLinked += linked.length;
      }
    }
    return { value: { organisationsCreated, engagementsLinked } };
  });
  return result.value;
}

export async function listOrganisations(
  db: OperationsDb,
  context: OperationsFounder | null,
  after?: string,
): Promise<OrganisationPage> {
  const founder = requireOperationsFounder(context);
  const cursor = after ? z.uuid().parse(after) : null;
  const result = await db.begin(async (tx) => {
    await setFounder(tx, founder);
    const rows = await tx<OrganisationPage["rows"]>`
      select o.id, o.legal_name as "legalName", o.display_name as "displayName",
        o.trading_status as "tradingStatus", o.timezone, o.lifecycle,
        (select count(*)::int from operations.engagement_links e where e.organisation_id = o.id) as "engagementCount"
      from operations.organisations o
      where (${cursor}::uuid is null or o.id > ${cursor}::uuid)
      order by o.id limit 51
    `;
    return {
      value: {
        rows: rows.slice(0, 50),
        nextCursor: rows.length > 50 ? rows[49].id : null,
      },
    };
  });
  return result.value;
}
