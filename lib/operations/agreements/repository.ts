import { z } from "zod";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { requireOperationsFounder } from "../organisations/link-engagement";
import type { OperationsFounder } from "../organisations/types";
import type {
  AgreementDraft,
  AgreementRecord,
  AgreementRegister,
} from "./types";

export async function withAgreementTransaction<T>(
  db: OperationsDb,
  context: OperationsFounder | null,
  run: (tx: OperationsTransaction, founder: OperationsFounder) => Promise<T>,
): Promise<T> {
  const founder = requireOperationsFounder(context);
  const result = await db.begin(async (tx) => {
    await tx`select set_config('operations.actor_id', ${founder.actorId}, true)`;
    return { value: await run(tx, founder) };
  });
  return result.value;
}
export async function insertRevision(
  tx: OperationsTransaction,
  organisationId: string,
  agreementId: string,
  revision: number,
  draft: AgreementDraft,
  actorId: string,
  correlationId: string,
): Promise<void> {
  await tx`insert into operations.agreement_revisions(organisation_id,agreement_id,revision,snapshot,created_by,correlation_id) values (${organisationId},${agreementId},${revision},${tx.json(draft)},${actorId},${correlationId})`;
  for (const [index, line] of draft.lines.entries()) {
    await tx`insert into operations.agreement_lines(organisation_id,agreement_id,revision,line_number,service_code,description,quantity,unit_pence,discount_pence,tax_pence,recurrence_months,start_date,end_date)
      values (${organisationId},${agreementId},${revision},${index + 1},${line.serviceCode},${line.description},${line.quantity},${line.unitPence},${line.discountPence},${line.taxPence},${line.recurrenceMonths},${line.startDate},${line.endDate})`;
  }
}
async function loadAgreements(
  tx: OperationsTransaction,
  organisationId: string,
  agreementId: string | null,
  after: string | null,
): Promise<AgreementRecord[]> {
  const rows = await tx<
    AgreementRecord[]
  >`select a.id,a.engagement_id as "engagementId",a.version,a.current_revision as revision,a.status,r.snapshot as draft,
    (select evidence from operations.signature_evidence e where e.organisation_id=a.organisation_id and e.agreement_id=a.id and e.revision=a.current_revision) as evidence,
    coalesce((select jsonb_agg(jsonb_build_object('lineNumber',s.line_number,'effectiveDate',s.effective_date::text,'endDate',s.end_date::text,'status',s.status) order by s.line_number) from operations.service_instances s where s.organisation_id=a.organisation_id and s.agreement_id=a.id and s.revision=a.current_revision),'[]'::jsonb) as services
    from operations.agreements a join operations.agreement_revisions r on r.organisation_id=a.organisation_id and r.agreement_id=a.id and r.revision=a.current_revision
    where a.organisation_id=${organisationId} and (${agreementId}::uuid is null or a.id=${agreementId}::uuid) and (${after}::uuid is null or a.id>${after}::uuid) order by a.id limit 51`;
  return rows;
}
export async function loadAgreement(
  tx: OperationsTransaction,
  organisationId: string,
  agreementId: string,
): Promise<AgreementRecord | null> {
  return (
    (await loadAgreements(tx, organisationId, agreementId, null))[0] ?? null
  );
}
export async function listAgreementRegister(
  db: OperationsDb,
  context: OperationsFounder | null,
  organisationId: string,
  after?: string,
): Promise<AgreementRegister | null> {
  z.uuid().parse(organisationId);
  const cursor = after ? z.uuid().parse(after) : null;
  return withAgreementTransaction(db, context, async (tx) => {
    const [organisation] = await tx<
      { display_name: string }[]
    >`select display_name from operations.organisations where id=${organisationId}`;
    if (!organisation) return null;
    const links = await tx<
      { engagement_id: string }[]
    >`select engagement_id from operations.engagement_links where organisation_id=${organisationId} order by engagement_id limit 101`;
    const rows = await loadAgreements(tx, organisationId, null, cursor);
    return {
      organisationName: organisation.display_name,
      engagementIds: links.slice(0, 100).map((l) => l.engagement_id),
      moreEngagements: links.length > 100,
      agreements: rows.slice(0, 50),
      nextCursor: rows.length > 50 ? rows[49].id : null,
    };
  });
}
