import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import type { GrowthTransaction } from "../db/types";
import { CrmError } from "./errors";
import {
  captureBusiness,
  captureContact,
  findCapture,
} from "./lead-repository";
import type { CaptureLead, CrmCommandResult } from "./schemas";

export async function captureLead(
  tx: GrowthTransaction,
  input: CaptureLead,
  founder: FounderSession,
  correlationId: string,
): Promise<CrmCommandResult> {
  const previous = await findCapture(tx, input, founder.actorId);
  if (previous) return { prospectId: previous, alreadyExisted: true };
  const businessId = await captureBusiness(tx, input);
  const [open] = await tx<
    { id: string; commercialStage: string | null }[]
  >`select p.id,de.stage as "commercialStage" from growth.prospects p
    left join growth.delivery_engagements de on de.prospect_id=p.id
    where p.business_id=${businessId} and p.status not in ('won','lost','rejected','suppressed') for update of p`;
  if (open) {
    if (open.commercialStage !== "won" && open.commercialStage !== "lost")
      throw new CrmError("duplicate", open.id);
    // Older stage transitions did not project closure onto the prospect.
    // Repair that projection under the prospect lock before reusing this business.
    await tx`update growth.prospects set status=${open.commercialStage}::growth.prospect_status,version=version+1,updated_at=now() where id=${open.id}`;
    await appendAuditEvent(tx, {
      correlationId,
      actorType: "founder",
      actorId: founder.actorId,
      action: "crm.reconcile_commercial_status",
      entityType: "prospect",
      entityId: open.id,
    });
  }
  const contactId = await captureContact(tx, input.contact, businessId);
  const [prospect] = await tx<{ id: string }[]>`insert into growth.prospects
    (business_id,primary_contact_id,status,fit_score,opportunity_summary,recommended_offer,estimated_one_off_min_pence,estimated_one_off_max_pence,estimated_monthly_pence,assigned_owner_email)
    values (${businessId},${contactId},'needs_review',0,${input.opportunitySummary},${input.recommendedOffer},${input.oneOffMinPence},${input.oneOffMaxPence},${input.monthlyPence},${founder.email}) returning id`;
  await tx`insert into growth.crm_capture_requests (id,prospect_id,inbound_lead_id,actor_id)
    values (${input.requestId},${prospect.id},${input.inboundLeadId ?? null},${founder.actorId})`;
  return { prospectId: prospect.id };
}
