import type { GrowthTransaction } from "../db/types";
import { requireCrmProspect } from "./activity-service";
import { captureContact } from "./lead-repository";
import { CrmError } from "./errors";
import type { CrmCommand, CrmCommandResult } from "./schemas";

export async function attachCrmContact(
  tx: GrowthTransaction,
  command: Extract<CrmCommand, { kind: "attach_contact" }>,
): Promise<CrmCommandResult> {
  const prospect = await requireCrmProspect(tx, command.prospectId);
  if (prospect.version !== command.expectedVersion)
    throw new CrmError("version_conflict");
  const [identity] = await tx<
    { businessId: string; contactId: string | null }[]
  >`select business_id as "businessId",primary_contact_id as "contactId" from growth.prospects where id=${prospect.id}`;
  if (identity.contactId) throw new CrmError("duplicate", prospect.id);
  const contactId = await captureContact(
    tx,
    command.contact,
    identity.businessId,
  );
  await tx`update growth.prospects set primary_contact_id=${contactId},version=version+1,updated_at=now() where id=${prospect.id}`;
  return { prospectId: prospect.id };
}
export async function createCrmOpportunity(
  tx: GrowthTransaction,
  command: Extract<CrmCommand, { kind: "create_opportunity" }>,
): Promise<CrmCommandResult> {
  const prospect = await requireCrmProspect(tx, command.prospectId);
  const [existing] = await tx<
    { id: string }[]
  >`select id from growth.delivery_engagements where prospect_id=${prospect.id}`;
  if (existing) {
    if (existing.id === command.requestId)
      return {
        prospectId: prospect.id,
        recordId: existing.id,
        alreadyExisted: true,
      };
    throw new CrmError("duplicate", prospect.id);
  }
  if (prospect.version !== command.expectedVersion)
    throw new CrmError("version_conflict");
  const [record] = await tx<
    { status: string }[]
  >`select status from growth.prospects where id=${prospect.id}`;
  if (["won", "lost", "rejected", "suppressed"].includes(record.status))
    throw new CrmError("closed");
  await tx`insert into growth.delivery_engagements(id,prospect_id,name,one_off_value_pence,monthly_value_pence)
  select ${command.requestId},id,recommended_offer,estimated_one_off_max_pence,estimated_monthly_pence from growth.prospects where id=${prospect.id}`;
  return { prospectId: prospect.id, recordId: command.requestId };
}
