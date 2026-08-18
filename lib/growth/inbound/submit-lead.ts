import { appendAuditEvent } from "../audit/service";
import { withGrowthTransaction } from "../db/client";
import type { GrowthDb, GrowthTransaction } from "../db/types";
import { NewsletterConsentError, recordNewsletterOptIn } from "../newsletter/subscribers";
import { createNewsletterSubscriberRepository } from "../newsletter/subscribers-repository";

const NEWSLETTER_CONSENT_TEXT_VERSION = "v1";
const NEWSLETTER_CONSENT_SOURCE = "lead_capture_form";

export type SubmitLeadInput = {
  submissionId: string;
  submissionType: "site_enquiry" | "resource_request";
  firstName: string;
  lastName: string;
  workEmail: string;
  businessName: string;
  challenge?: string;
  sourcePath: string;
  sourceContext: string;
  resourceSlug?: string;
  newsletterOptIn: boolean;
};

export type InboundLeadRecord = {
  id: string;
  submissionId: string;
  workEmail: string;
};

export type SubmitLeadResult = {
  leadId: string;
  submissionId: string;
  alreadySubmitted: boolean;
};

export type InsertInboundLeadInput = SubmitLeadInput & {
  consentTextVersion: string | null;
  submittedAt: Date;
};

export type SubmitLeadDependencies = {
  insertInboundLead: (
    input: InsertInboundLeadInput,
  ) => Promise<{ record: InboundLeadRecord; alreadyExisted: boolean }>;
  recordNewsletterConsent: (input: SubmitLeadInput, consentedAt: Date) => Promise<void>;
  appendLeadAuditEvent: (leadId: string, submissionId: string) => Promise<void>;
  now?: () => Date;
};

export async function submitLead(
  input: SubmitLeadInput,
  dependencies: SubmitLeadDependencies,
): Promise<SubmitLeadResult> {
  const now = dependencies.now?.() ?? new Date();

  const { record, alreadyExisted } = await dependencies.insertInboundLead({
    ...input,
    consentTextVersion: input.newsletterOptIn ? NEWSLETTER_CONSENT_TEXT_VERSION : null,
    submittedAt: now,
  });

  if (alreadyExisted) {
    return { leadId: record.id, submissionId: record.submissionId, alreadySubmitted: true };
  }

  if (input.newsletterOptIn) {
    try {
      await dependencies.recordNewsletterConsent(input, now);
    } catch (error) {
      // A suppressed address or stale re-consent is a legitimate business
      // rule rejection, not a reason to lose an otherwise-valid enquiry.
      if (!(error instanceof NewsletterConsentError)) {
        throw error;
      }
    }
  }

  await dependencies.appendLeadAuditEvent(record.id, input.submissionId);

  return { leadId: record.id, submissionId: record.submissionId, alreadySubmitted: false };
}

export function createSubmitLeadRepository(tx: GrowthTransaction): SubmitLeadDependencies {
  return {
    async insertInboundLead(input) {
      const [inserted] = await tx<InboundLeadRecord[]>`
        insert into growth.inbound_leads (
          submission_id, submission_type, first_name, last_name,
          work_email, business_name, challenge, source_path, source_context,
          resource_slug, newsletter_opt_in, consent_text_version, submitted_at
        ) values (
          ${input.submissionId}, ${input.submissionType}, ${input.firstName}, ${input.lastName},
          ${input.workEmail}, ${input.businessName}, ${input.challenge ?? null},
          ${input.sourcePath}, ${input.sourceContext}, ${input.resourceSlug ?? null},
          ${input.newsletterOptIn}, ${input.consentTextVersion}, ${input.submittedAt}
        )
        on conflict (submission_id) do nothing
        returning id, submission_id as "submissionId", work_email as "workEmail"
      `;
      if (inserted) {
        return { record: inserted, alreadyExisted: false };
      }

      const [existing] = await tx<InboundLeadRecord[]>`
        select id, submission_id as "submissionId", work_email as "workEmail"
        from growth.inbound_leads
        where submission_id = ${input.submissionId}
      `;
      return { record: existing, alreadyExisted: true };
    },
    async recordNewsletterConsent(input, consentedAt) {
      await recordNewsletterOptIn(
        {
          email: input.workEmail,
          firstName: input.firstName,
          businessName: input.businessName,
          consentSource: NEWSLETTER_CONSENT_SOURCE,
          consentTextVersion: NEWSLETTER_CONSENT_TEXT_VERSION,
          consentEvidence: `checkbox on ${input.sourcePath}`,
          consentedAt,
        },
        createNewsletterSubscriberRepository(tx),
      );
    },
    async appendLeadAuditEvent(leadId, submissionId) {
      await appendAuditEvent(tx, {
        correlationId: submissionId,
        actorType: "system",
        actorId: "lead_capture_form",
        action: "inbound_lead_submitted",
        entityType: "inbound_lead",
        entityId: leadId,
      });
    },
  };
}

export async function submitLeadInTransaction(
  input: SubmitLeadInput,
  db: GrowthDb,
): Promise<SubmitLeadResult> {
  return withGrowthTransaction(db, (tx) => submitLead(input, createSubmitLeadRepository(tx)));
}
