import { z } from "zod";
import type { OperationsDb } from "../db/client";
import type { OperationsFounder } from "../organisations/types";
import { withAgreementTransaction } from "../agreements/repository";

export type BillingException = {
  id: string;
  organisationId: string | null;
  organisationName: string | null;
  category: string;
  objectId: string;
  mode: "test" | "live";
  createdAt: string;
  lastSeenAt: string;
};

export async function listBillingExceptions(
  db: OperationsDb,
  founder: OperationsFounder | null,
  after?: string,
): Promise<{ rows: BillingException[]; nextCursor: string | null }> {
  const cursor = after === undefined ? null : z.uuid().parse(after);
  return withAgreementTransaction(db, founder, async (tx) => {
    const rows = await tx<BillingException[]>`
      select e.id,e.organisation_id as "organisationId",o.display_name as "organisationName",
      e.category,e.object_id as "objectId",e.environment as mode,
      e.created_at::text as "createdAt",e.last_seen_at::text as "lastSeenAt"
      from operations.billing_exceptions e
      left join operations.organisations o on o.id=e.organisation_id
      where e.resolved_at is null and (${cursor}::uuid is null or e.id>${cursor}::uuid)
      order by e.id limit 51`;
    return {
      rows: [...rows.slice(0, 50)],
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  });
}
