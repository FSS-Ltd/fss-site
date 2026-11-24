import { createHash } from "node:crypto";
import { z } from "zod";
import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import { CrmError } from "../crm/errors";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb } from "../db/types";
import { sourceLeadInputSchema } from "./schemas";

const publicUrl = sourceLeadInputSchema.shape.sourceUrl.refine(
  (value) =>
    ![".internal", ".localhost", ".local", ".test"].some((suffix) =>
      new URL(value).hostname.toLowerCase().endsWith(suffix),
    ),
);
export const founderVerificationInputSchema = z.strictObject({
  requestId: z.uuid(),
  prospectId: z.uuid(),
  expectedProspectVersion: z.number().int().positive(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  firstName: z.string().trim().min(1).max(100).nullable(),
  lastName: z.string().trim().min(1).max(100).nullable(),
  contactSourceUrl: publicUrl,
  contactObservedAt: z.coerce.date(),
  observationSourceUrl: publicUrl,
  observation: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .refine((value) => !/[\u0000-\u001f\u007f]/.test(value)),
  observedAt: z.coerce.date(),
});
export type FounderVerificationInput = z.infer<
  typeof founderVerificationInputSchema
>;
export type FounderVerificationResult = {
  prospectId: string;
  contactId: string;
  prospectVersion: number;
  contactVersion: number;
  alreadyExisted: boolean;
};

export async function verifyFounderEvidence(
  db: GrowthDb,
  raw: FounderVerificationInput,
  founder: FounderSession,
  correlationId: string,
): Promise<FounderVerificationResult> {
  const input = founderVerificationInputSchema.parse(raw);
  if (
    founder.email !== "j.ntagengwa@faithfulsoftware.dev" ||
    founder.actorId !==
      createHash("sha256").update(founder.email).digest("hex") ||
    !correlationId.trim()
  )
    throw new CrmError("invalid");
  const requestHash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return withGrowthTransaction(db, async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:founder-evidence:${input.requestId}`}, 0))`;
    const previous = await tx<
      {
        requestHash: string;
        actorId: string;
        prospectId: string;
        contactId: string;
        prospectVersion: number;
        contactVersion: number;
      }[]
    >`select request_hash as "requestHash", founder_actor_id as "actorId", prospect_id as "prospectId", contact_id as "contactId", prospect_version as "prospectVersion", contact_version as "contactVersion" from growth.source_evidence where origin='founder' and request_id=${input.requestId}`;
    if (previous.length) {
      if (
        previous.length !== 2 ||
        previous.some(
          (row) =>
            row.requestHash !== requestHash || row.actorId !== founder.actorId,
        )
      )
        throw new CrmError("invalid");
      const row = previous[0]!;
      return {
        prospectId: row.prospectId,
        contactId: row.contactId,
        prospectVersion: row.prospectVersion,
        contactVersion: row.contactVersion,
        alreadyExisted: true,
      };
    }
    const [prospect] = await tx<
      { businessId: string; contactId: string | null; version: number }[]
    >`select business_id as "businessId", primary_contact_id as "contactId", version from growth.prospects where id=${input.prospectId} for update`;
    if (!prospect) throw new CrmError("not_found");
    if (prospect.version !== input.expectedProspectVersion)
      throw new CrmError("version_conflict");
    await tx`select pg_advisory_xact_lock(hashtextextended(${`growth:contact:${input.email}`}, 0))`;
    const [existing] = await tx<
      { id: string; businessId: string }[]
    >`select id,business_id as "businessId" from growth.contacts where normalised_email=${input.email} for update`;
    if (
      existing &&
      (existing.businessId !== prospect.businessId ||
        (prospect.contactId && prospect.contactId !== existing.id))
    )
      throw new CrmError("contact_conflict");
    if (!existing && prospect.contactId) throw new CrmError("contact_conflict");
    const now = new Date();
    for (const observed of [input.contactObservedAt, input.observedAt]) {
      const age = now.getTime() - observed.getTime();
      if (age < 0 || age > 30 * 86400000) throw new CrmError("invalid");
    }

    let contactId: string;
    let contactVersion: number;
    if (existing) {
      const [other] =
        await tx`select id from growth.prospects where primary_contact_id=${existing.id} and id<>${input.prospectId} limit 1`;
      if (other) throw new CrmError("contact_conflict");
      const [updated] = await tx<
        { version: number }[]
      >`update growth.contacts set version=version+1, updated_at=now() where id=${existing.id} returning version`;
      if (!updated) throw new Error("Contact update returned no row.");
      contactId = existing.id;
      contactVersion = updated.version;
    } else {
      const [created] = await tx<
        { id: string; version: number }[]
      >`insert into growth.contacts (business_id,first_name,last_name,role_title,email,email_source_url,email_verified_at,subscriber_type,lawful_basis,email_source_visibility) values (${prospect.businessId},${input.firstName},${input.lastName},null,${input.email},${input.contactSourceUrl},${now},'uncertain','research_only','private_founder') returning id,version`;
      if (!created) throw new Error("Contact insert returned no row.");
      contactId = created.id;
      contactVersion = created.version;
    }
    const [updatedProspect] = await tx<
      { version: number }[]
    >`update growth.prospects set primary_contact_id=${contactId},version=version+1,updated_at=now() where id=${input.prospectId} returning version`;
    if (!updatedProspect) throw new Error("Prospect update returned no row.");
    for (const proof of [
      {
        type: "contact_email",
        url: input.contactSourceUrl,
        summary: "Founder verified the contact email from this source.",
        observedAt: input.contactObservedAt,
      },
      {
        type: "business_observation",
        url: input.observationSourceUrl,
        summary: input.observation,
        observedAt: input.observedAt,
      },
    ]) {
      await tx`insert into growth.source_evidence (prospect_id,research_run_id,source_type,source_url,claim_type,claim_summary,observed_at,verified_at,retention_class,origin,founder_actor_id,request_id,request_hash,contact_id,business_id,contact_version,prospect_version) values (${input.prospectId},null,'founder_verified',${proof.url},${proof.type},${proof.summary},${proof.observedAt},${now},'prospect_research','founder',${founder.actorId},${input.requestId},${requestHash},${contactId},${prospect.businessId},${contactVersion},${updatedProspect.version})`;
    }
    await appendAuditEvent(tx, {
      correlationId,
      actorType: "founder",
      actorId: founder.actorId,
      action: "crm.verify_founder_evidence",
      entityType: "prospect",
      entityId: input.prospectId,
    });
    return {
      prospectId: input.prospectId,
      contactId,
      prospectVersion: updatedProspect.version,
      contactVersion,
      alreadyExisted: false,
    };
  });
}
