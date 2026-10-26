import type { GrowthTransaction } from "../db/types";
import { CrmError } from "./errors";
import type { CrmCommand, CrmCommandResult } from "./schemas";

type RecordCommand = Extract<
  CrmCommand,
  {
    kind:
      | "update_prospect"
      | "update_business"
      | "update_contact"
      | "update_opportunity";
  }
>;
export async function updateCrmRecord(
  tx: GrowthTransaction,
  command: RecordCommand,
): Promise<CrmCommandResult> {
  const [prospect] = await tx<
    {
      id: string;
      businessId: string;
      contactId: string | null;
      version: number;
      status: string;
    }[]
  >`
   select id,business_id as "businessId",primary_contact_id as "contactId",version,status from growth.prospects where id=${command.prospectId} for update`;
  if (!prospect) throw new CrmError("not_found");
  if (command.kind === "update_prospect") {
    if (["won", "lost", "rejected", "suppressed"].includes(prospect.status))
      throw new CrmError("closed");
    if (prospect.version !== command.expectedVersion)
      throw new CrmError("version_conflict");
    await tx`update growth.prospects set opportunity_summary=${command.opportunitySummary},recommended_offer=${command.recommendedOffer},
   estimated_one_off_min_pence=${command.oneOffMinPence},estimated_one_off_max_pence=${command.oneOffMaxPence},estimated_monthly_pence=${command.monthlyPence},version=version+1,updated_at=now() where id=${prospect.id}`;
  } else if (command.kind === "update_business") {
    const [row] =
      await tx`update growth.businesses set trading_name=${command.tradingName},sector=${command.sector},locality=${command.locality},website_url=${command.websiteUrl},version=version+1,updated_at=now()
   where id=${prospect.businessId} and version=${command.expectedVersion} returning id`;
    if (!row) throw new CrmError("version_conflict");
  } else if (command.kind === "update_contact") {
    if (!prospect.contactId) throw new CrmError("not_found");
    const [row] =
      await tx`update growth.contacts set first_name=${command.firstName},last_name=${command.lastName},role_title=${command.roleTitle},version=version+1,updated_at=now()
   where id=${prospect.contactId} and business_id=${prospect.businessId} and version=${command.expectedVersion} returning id`;
    if (!row) throw new CrmError("version_conflict");
  } else {
    const [engagement] = await tx<
      { version: number; stage: string }[]
    >`select version,stage from growth.delivery_engagements where id=${command.engagementId} and prospect_id=${prospect.id} for update`;
    if (!engagement) throw new CrmError("not_found");
    if (["won", "lost"].includes(engagement.stage))
      throw new CrmError("closed");
    if (engagement.version !== command.expectedVersion)
      throw new CrmError("version_conflict");
    await tx`update growth.delivery_engagements set name=${command.name},one_off_value_pence=${command.oneOffValuePence},monthly_value_pence=${command.monthlyValuePence},probability_percent=${command.probabilityPercent},expected_close_date=${command.expectedCloseDate},version=version+1,updated_at=now() where id=${command.engagementId}`;
  }
  return { prospectId: prospect.id };
}
