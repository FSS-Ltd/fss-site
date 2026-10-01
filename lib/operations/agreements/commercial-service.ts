import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { OperationsDb, OperationsTransaction } from "../db/client";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import { withPortalTransaction } from "../db/portal-client";
import type { VerifiedPortalIdentity } from "../auth/types";
import { AgreementConflict, type AgreementDraft } from "./types";
import { renderAgreementSource, signingHash } from "./signing-render";
import { signingOperation } from "./signing-service";
import { loadCommercialOffers } from "./commercial-repository";
import {
  commercialSelectionDraft,
  publishCommercialOfferSchema,
  portalCommercialOfferCommandSchema,
  recurringTotalMinor,
  staffCommercialOfferCommandSchema,
  type CommercialOffer,
} from "./commercial-types";
export {
  listStaffCommercialOffers,
  listPortalCommercialOffers,
  getStaffCommercialOffer,
  getPortalCommercialOffer,
} from "./commercial-repository";

async function retainBranch(
  tx: OperationsTransaction,
  offer: CommercialOffer,
  option: string,
  draft: AgreementDraft,
  approvedBy: string,
): Promise<void> {
  const [organisation] = await tx<
    { legalName: string }[]
  >`select legal_name as "legalName" from operations.organisations where id=${offer.organisationId}`;
  const approvalId = randomUUID();
  const source = await renderAgreementSource(draft, organisation.legalName);
  const snapshot = {
    ...draft,
    documentHash: signingHash(source),
    documentReference: `private:signing/${approvalId}/source.pdf`,
  };
  await tx`insert into operations.commercial_offer_branches(offer_id,option,approval_id,organisation_legal_name,snapshot,source_pdf,source_hash,approved_by) values(${offer.id},${option},${approvalId},${organisation.legalName},${tx.json(snapshot)},${source},${snapshot.documentHash},${approvedBy})`;
}
export async function publishStaffCommercialOffer(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<CommercialOffer> {
  z.uuid().parse(organisationId);
  z.uuid().parse(correlationId);
  const input = publishCommercialOfferSchema.parse(raw);
  return signingOperation(() =>
    withFssAdminTransaction(db, admin, async (tx) => {
      if (input.sourceDraftId) {
        const [existing] = await tx<
          { id: string; version: number }[]
        >`select id,source_draft_version as version from operations.commercial_offers where source_draft_id=${input.sourceDraftId} and organisation_id=${organisationId}`;
        if (existing) {
          if (existing.version !== input.sourceDraftVersion)
            throw new AgreementConflict();
          return (
            await loadCommercialOffers(tx, organisationId, existing.id)
          )[0];
        }
      }
      const id = randomUUID();
      await tx`insert into operations.commercial_offers(id,organisation_id,engagement_id,draft,spec,expires_at,created_by,correlation_id,source_draft_id,source_draft_version) values(${id},${organisationId},${input.engagementId},${tx.json(input.draft)},${tx.json(input.spec)},${input.expiresAt},${admin.actorId},${correlationId},${input.sourceDraftId ?? null},${input.sourceDraftVersion ?? null})`;
      const offer = (await loadCommercialOffers(tx, organisationId, id))[0];
      if (input.spec.cash?.mode === "fixed")
        await retainBranch(
          tx,
          offer,
          "cash",
          commercialSelectionDraft(input.draft, input.spec, "cash"),
          admin.actorId,
        );
      if (input.spec.revenueShare?.mode === "fixed")
        await retainBranch(
          tx,
          offer,
          "revenue_share",
          commercialSelectionDraft(input.draft, input.spec, "revenue_share"),
          admin.actorId,
        );
      if (input.sourceDraftId)
        await tx`select operations.mark_builder_offer(${organisationId},${input.sourceDraftId},${input.sourceDraftVersion ?? null},${id})`;
      return offer;
    }),
  );
}
export async function executeStaffCommercialOfferCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<CommercialOffer> {
  const command = staffCommercialOfferCommandSchema.parse(raw);
  if (command.action === "publish")
    return publishStaffCommercialOffer(
      db,
      admin,
      organisationId,
      {
        engagementId: command.engagementId,
        draft: command.draft,
        spec: command.spec,
        expiresAt: command.expiresAt,
      },
      correlationId,
    );
  return signingOperation(() =>
    withFssAdminTransaction(db, admin, async (tx) => {
      await tx`select operations.lock_commercial_offer(${organisationId},${command.offerId})`;
      const offer = (
        await loadCommercialOffers(tx, organisationId, command.offerId)
      )[0];
      if (!offer || offer.version !== command.expectedVersion)
        throw new AgreementConflict();
      if (command.action === "approve") {
        if (offer.status !== "proposed" || !offer.selection)
          throw new AgreementConflict();
        const selection = offer.selection;
        let draft = commercialSelectionDraft(
          offer.draft,
          offer.spec,
          selection.option,
          selection.percentageBps,
        );
        if (selection.option === "cash") {
          if (
            !command.draft ||
            recurringTotalMinor(command.draft) !==
              selection.recurringAmountMinor
          )
            throw new AgreementConflict(
              "Allocate the exact proposed recurring total across the service lines.",
            );
          draft = command.draft;
        }
        await retainBranch(
          tx,
          offer,
          `proposal_${offer.version}`,
          draft,
          admin.actorId,
        );
      }
      await tx`select operations.review_commercial_offer(${organisationId},${command.offerId},${command.expectedVersion},${command.action},${command.action === "reject" ? command.reason : null},${correlationId})`;
      return (
        await loadCommercialOffers(tx, organisationId, command.offerId)
      )[0];
    }),
  );
}
export async function executePortalCommercialOfferCommand(
  db: OperationsDb,
  identity: VerifiedPortalIdentity,
  organisationId: string,
  raw: unknown,
  correlationId: string,
): Promise<CommercialOffer> {
  const command = portalCommercialOfferCommandSchema.parse(raw);
  return signingOperation(() =>
    withPortalTransaction(
      db,
      identity,
      organisationId,
      correlationId,
      async (tx) => {
        await tx`select operations.select_commercial_offer(${organisationId},${command.offerId},${command.expectedVersion},${command.option},${command.recurringAmountMinor ?? null},${command.percentageBps ?? null},${correlationId})`;
        return (
          await loadCommercialOffers(tx, organisationId, command.offerId)
        )[0];
      },
    ),
  );
}
