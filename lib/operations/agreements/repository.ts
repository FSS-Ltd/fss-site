import { z } from "zod";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { requireOperationsFounder } from "../organisations/link-engagement";
import type { OperationsFounder } from "../organisations/types";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type {
  AgreementDraft,
  AgreementRecord,
  AgreementRegister,
} from "./types";
import { AgreementConflict } from "./types";

export async function assertNoPendingExecution(
  tx: OperationsTransaction,
  agreementId: string,
): Promise<void> {
  const [pending] = await tx<{ pending: boolean }[]>`
    select exists(select 1 from operations.signing_approvals p
      where p.agreement_id=${agreementId} and p.status='approved'
      and (select count(*) from operations.signing_signatures s where s.approval_id=p.id and s.signed_at<=p.expires_at)=jsonb_array_length(p.snapshot->'signatories')) as pending`;
  if (pending.pending)
    throw new AgreementConflict(
      "All parties have signed. The completed document is being retained; this agreement cannot be replaced.",
    );
}

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
    (select provenance from operations.signature_evidence e where e.organisation_id=a.organisation_id and e.agreement_id=a.id and e.revision=a.current_revision) as "evidenceProvenance",
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
  return withAgreementTransaction(db, context, (tx) =>
    readAgreementRegister(tx, organisationId, cursor),
  );
}

async function readAgreementRegister(
  tx: OperationsTransaction,
  organisationId: string,
  cursor: string | null,
): Promise<AgreementRegister | null> {
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
    engagementIds: links.slice(0, 100).map((link) => link.engagement_id),
    moreEngagements: links.length > 100,
    agreements: rows.slice(0, 50),
    nextCursor: rows.length > 50 ? rows[49].id : null,
  };
}

export type StaffAgreementOverviewRow = {
  organisationId: string;
  organisationName: string;
  agreementCount: number;
  draftCount: number;
  signedCount: number;
};

export async function listStaffAgreementRegister(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  after?: string,
): Promise<AgreementRegister | null> {
  z.uuid().parse(organisationId);
  const cursor = after ? z.uuid().parse(after) : null;
  return withFssAdminTransaction(db, admin, async (tx) => {
    const register = await readAgreementRegister(tx, organisationId, cursor);
    if (!register) return null;
    const choices = await tx<Array<{ id: string; name: string }>>`
      select id, name from operations.staff_linked_engagements(${organisationId})
      limit 101
    `;
    return {
      ...register,
      engagementChoices: choices.slice(0, 100),
      moreEngagements: choices.length > 100,
    };
  });
}

export async function listStaffAgreementOverview(
  db: OperationsDb,
  admin: FssAdminContext,
): Promise<StaffAgreementOverviewRow[]> {
  return withFssAdminTransaction(
    db,
    admin,
    (tx) =>
      tx<StaffAgreementOverviewRow[]>`
      select o.id as "organisationId", o.display_name as "organisationName",
        count(a.id)::integer as "agreementCount",
        count(a.id) filter (where a.status = 'draft')::integer as "draftCount",
        count(a.id) filter (where a.status = 'signed')::integer as "signedCount"
      from operations.organisations o
      left join operations.agreements a on a.organisation_id = o.id
      where o.lifecycle = 'active'
      group by o.id, o.display_name
      order by o.display_name, o.id
      limit 200
    `,
  );
}
