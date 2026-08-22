import { createElement } from "react";

import { ClientDeliveryThankYou } from "@/emails/client-delivery-thank-you";
import { renderEmail } from "@/emails/render-email";

import { appendAuditEvent } from "../audit/service";
import type { FounderSession } from "../auth/require-founder";
import type { GrowthDb } from "../db/types";
import type { ResendGateway } from "../integrations/resend/client";

const MESSAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const FOUNDER_ACTOR_ID_PATTERN = /^[0-9a-f]{64}$/;
const CORRELATION_ID_MAX_LENGTH = 200;

// The site's on-site newsletter sign-up section. No signed consent-token
// endpoint exists yet (Plan 06 does not add one) - sending this link never
// creates consent, it only offers the client a place to opt in themselves.
export const NEWSLETTER_OPT_IN_URL =
  "https://faithfulsoftwaresolutions.co.uk/#newsletter";

export type ClientThankYouSnapshot = {
  subject: string;
  html: string;
  text: string;
  checksum: string;
};

/** Deterministic given (firstName, engagementName, includeNewsletterInvite) -
 * there is no founder-editable free text in this template, so re-rendering
 * at any point is always safe and never launders an unreviewed edit. */
export async function renderClientThankYouSnapshot(input: {
  firstName: string;
  engagementName: string;
  includeNewsletterInvite: boolean;
}): Promise<ClientThankYouSnapshot> {
  const element = createElement(ClientDeliveryThankYou, {
    firstName: input.firstName,
    engagementName: input.engagementName,
    newsletterOptInUrl: input.includeNewsletterInvite
      ? NEWSLETTER_OPT_IN_URL
      : undefined,
  });
  const rendered = await renderEmail({
    templateKey: "client-delivery-thank-you",
    element,
  });

  return {
    subject: `Thank you for trusting FSS with ${input.engagementName}`,
    html: rendered.html,
    text: rendered.text,
    checksum: rendered.checksum,
  };
}

export type ClientMessageStatus = "pending_approval" | "sent";

export type ClientThankYouRow = {
  id: string;
  engagementId: string;
  engagementName: string;
  version: number;
  status: ClientMessageStatus;
  includedNewsletterInvite: boolean;
  subjectSnapshot: string;
  htmlSnapshot: string;
  textSnapshot: string;
  checksum: string;
  recipientFirstName: string;
  recipientEmail: string;
  recipientNormalisedEmail: string;
  testSentAt: Date | null;
  testSentVersion: number | null;
};

export type RecordTestSentInput = {
  messageId: string;
  version: number;
  testSentAt: Date;
};

export type RecordInviteRemovedInput = {
  messageId: string;
  expectedVersion: number;
  subjectSnapshot: string;
  htmlSnapshot: string;
  textSnapshot: string;
  checksum: string;
};

export type RecordSentInput = {
  messageId: string;
  providerMessageId: string;
  sentAt: Date;
};

export interface ClientThankYouDependencies {
  getMessageById(messageId: string): Promise<ClientThankYouRow | null>;
  isSuppressed(normalisedEmail: string): Promise<boolean>;
  recordTestSent(input: RecordTestSentInput): Promise<void>;
  recordInviteRemoved(
    input: RecordInviteRemovedInput,
  ): Promise<{ id: string } | null>;
  recordSent(input: RecordSentInput): Promise<{ engagementId: string } | null>;
  markNewsletterInvited(engagementId: string, invitedAt: Date): Promise<void>;
}

export type ClientThankYouErrorCode =
  | "not_found"
  | "not_approvable"
  | "not_testable"
  | "version_conflict"
  | "suppressed_contact"
  | "send_failed";

export class ClientThankYouError extends Error {
  constructor(readonly code: ClientThankYouErrorCode) {
    super("The client thank-you message could not be completed.");
    this.name = "ClientThankYouError";
  }
}

async function requireMessage(
  repository: ClientThankYouDependencies,
  messageId: string,
): Promise<ClientThankYouRow> {
  if (!MESSAGE_ID_PATTERN.test(messageId)) {
    throw new ClientThankYouError("not_found");
  }
  const message = await repository.getMessageById(messageId);
  if (!message) throw new ClientThankYouError("not_found");
  return message;
}

function validateContext(founder: FounderSession, correlationId: string): void {
  if (
    !FOUNDER_ACTOR_ID_PATTERN.test(founder.actorId) ||
    !correlationId.trim() ||
    correlationId.length > CORRELATION_ID_MAX_LENGTH
  ) {
    throw new TypeError("Client thank-you request context is invalid.");
  }
}

// --- Founder test sending ---------------------------------------------------

export type SendClientThankYouTestInput = {
  messageId: string;
  founder: FounderSession;
  correlationId: string;
};

export type ClientThankYouTestResult = {
  messageId: string;
  providerMessageId: string;
  testSentAt: string;
};

export type ClientThankYouTestSenderDependencies = {
  repository: ClientThankYouDependencies;
  resend: Pick<ResendGateway, "send">;
  fromEmail: string;
  founderEmail: string;
  now?: () => Date;
};

/** Sends the stored pending snapshot to the founder's own address only.
 * Never touches the client-facing state or newsletter_invited_at. */
export function createClientThankYouTestSender(
  deps: ClientThankYouTestSenderDependencies,
) {
  const now = deps.now ?? (() => new Date());

  return async function sendClientThankYouTest(
    db: GrowthDb,
    input: SendClientThankYouTestInput,
  ): Promise<ClientThankYouTestResult> {
    validateContext(input.founder, input.correlationId);
    const message = await requireMessage(deps.repository, input.messageId);
    if (message.status !== "pending_approval") {
      throw new ClientThankYouError("not_testable");
    }

    let sent: { providerMessageId: string };
    try {
      sent = await deps.resend.send({
        idempotencyKey: `client_thank_you_test:${message.id}:${message.version}:${now().getTime()}`,
        category: "client-delivery-thank-you",
        from: deps.fromEmail,
        to: deps.founderEmail,
        replyTo: deps.founderEmail,
        subject: message.subjectSnapshot,
        html: message.htmlSnapshot,
        text: message.textSnapshot,
      });
    } catch {
      throw new ClientThankYouError("send_failed");
    }

    const testSentAt = now();
    await deps.repository.recordTestSent({
      messageId: message.id,
      version: message.version,
      testSentAt,
    });
    await appendAuditEvent(db, {
      correlationId: input.correlationId,
      actorType: "founder",
      actorId: input.founder.actorId,
      action: "client_message.test_sent",
      entityType: "client_message",
      entityId: message.id,
    });

    return {
      messageId: message.id,
      providerMessageId: sent.providerMessageId,
      testSentAt: testSentAt.toISOString(),
    };
  };
}

// --- Approve and send --------------------------------------------------------

export type ApproveSendClientThankYouInput = {
  messageId: string;
  expectedVersion: number;
  includeNewsletterInvite: boolean;
  founder: FounderSession;
  correlationId: string;
};

export type ApprovedClientThankYouResult = {
  messageId: string;
  engagementId: string;
  providerMessageId: string;
  sentAt: string;
};

export type ClientThankYouSenderDependencies = {
  repository: ClientThankYouDependencies;
  resend: Pick<ResendGateway, "send">;
  fromEmail: string;
  now?: () => Date;
};

/** Approves and sends the client thank-you in one founder action. The
 * request's includeNewsletterInvite can only narrow what the stored snapshot
 * already contains (remove the invitation block); it can never add an
 * invitation the creation-time subscription check excluded. When the
 * founder removes the block, the narrower snapshot is re-rendered and
 * persisted before it is sent, so what is stored always matches what goes
 * out. The Resend send happens after every check passes, using a stable,
 * per-engagement idempotency key so a retried request cannot double-send. */
export function createClientThankYouSender(
  deps: ClientThankYouSenderDependencies,
) {
  const now = deps.now ?? (() => new Date());

  return async function approveAndSendClientThankYou(
    db: GrowthDb,
    input: ApproveSendClientThankYouInput,
  ): Promise<ApprovedClientThankYouResult> {
    validateContext(input.founder, input.correlationId);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) {
      throw new TypeError("Client thank-you request is invalid.");
    }

    const message = await requireMessage(deps.repository, input.messageId);
    if (message.status !== "pending_approval") {
      throw new ClientThankYouError("not_approvable");
    }
    if (message.version !== input.expectedVersion) {
      throw new ClientThankYouError("version_conflict");
    }
    if (await deps.repository.isSuppressed(message.recipientNormalisedEmail)) {
      throw new ClientThankYouError("suppressed_contact");
    }

    const includeInvite =
      message.includedNewsletterInvite && input.includeNewsletterInvite;

    let content = {
      subject: message.subjectSnapshot,
      html: message.htmlSnapshot,
      text: message.textSnapshot,
    };

    if (includeInvite !== message.includedNewsletterInvite) {
      const rendered = await renderClientThankYouSnapshot({
        firstName: message.recipientFirstName,
        engagementName: message.engagementName,
        includeNewsletterInvite: false,
      });
      content = rendered;
      const updated = await deps.repository.recordInviteRemoved({
        messageId: message.id,
        expectedVersion: input.expectedVersion,
        subjectSnapshot: rendered.subject,
        htmlSnapshot: rendered.html,
        textSnapshot: rendered.text,
        checksum: rendered.checksum,
      });
      if (!updated) throw new ClientThankYouError("version_conflict");
    }

    let sent: { providerMessageId: string };
    try {
      sent = await deps.resend.send({
        idempotencyKey: `client_thank_you:${message.engagementId}`,
        category: "client-delivery-thank-you",
        from: deps.fromEmail,
        to: message.recipientEmail,
        replyTo: deps.fromEmail,
        subject: content.subject,
        html: content.html,
        text: content.text,
      });
    } catch {
      throw new ClientThankYouError("send_failed");
    }

    const sentAt = now();
    const recorded = await deps.repository.recordSent({
      messageId: message.id,
      providerMessageId: sent.providerMessageId,
      sentAt,
    });

    if (recorded && includeInvite) {
      await deps.repository.markNewsletterInvited(message.engagementId, sentAt);
    }
    if (recorded) {
      await appendAuditEvent(db, {
        correlationId: input.correlationId,
        actorType: "founder",
        actorId: input.founder.actorId,
        action: "client_message.sent",
        entityType: "client_message",
        entityId: message.id,
      });
    }

    return {
      messageId: message.id,
      engagementId: message.engagementId,
      providerMessageId: sent.providerMessageId,
      sentAt: sentAt.toISOString(),
    };
  };
}

// --- Postgres-backed dependencies -------------------------------------------

type ClientThankYouRowSql = ClientThankYouRow;

export function createPostgresClientThankYouDependencies(
  db: GrowthDb,
): ClientThankYouDependencies {
  return {
    async getMessageById(messageId) {
      const rows = await db<ClientThankYouRowSql[]>`
        select
          cm.id,
          cm.engagement_id as "engagementId",
          de.name as "engagementName",
          cm.version,
          cm.status,
          cm.included_newsletter_invite as "includedNewsletterInvite",
          cm.subject_snapshot as "subjectSnapshot",
          cm.html_snapshot as "htmlSnapshot",
          cm.text_snapshot as "textSnapshot",
          cm.checksum,
          c.first_name as "recipientFirstName",
          c.email as "recipientEmail",
          c.normalised_email as "recipientNormalisedEmail",
          cm.test_sent_at as "testSentAt",
          cm.test_sent_version as "testSentVersion"
        from growth.client_messages cm
        inner join growth.delivery_engagements de on de.id = cm.engagement_id
        inner join growth.contacts c on c.id = cm.recipient_contact_id
        where cm.id = ${messageId}
      `;
      return rows[0] ?? null;
    },

    async isSuppressed(normalisedEmail) {
      const rows = await db<Array<{ exists: boolean }>>`
        select exists (
          select 1 from growth.suppressions where normalised_email = ${normalisedEmail}
        ) as exists
      `;
      return rows[0]?.exists === true;
    },

    async recordTestSent(input) {
      await db`
        update growth.client_messages
        set test_sent_at = ${input.testSentAt},
            test_sent_version = ${input.version},
            updated_at = now()
        where id = ${input.messageId}
      `;
    },

    async recordInviteRemoved(input) {
      const rows = await db<Array<{ id: string }>>`
        update growth.client_messages
        set subject_snapshot = ${input.subjectSnapshot},
            html_snapshot = ${input.htmlSnapshot},
            text_snapshot = ${input.textSnapshot},
            checksum = ${input.checksum},
            included_newsletter_invite = false,
            version = version + 1,
            updated_at = now()
        where id = ${input.messageId}
          and version = ${input.expectedVersion}
          and status = 'pending_approval'
        returning id
      `;
      return rows[0] ?? null;
    },

    async recordSent(input) {
      const rows = await db<Array<{ engagementId: string }>>`
        update growth.client_messages
        set status = 'sent',
            provider_message_id = ${input.providerMessageId},
            sent_at = ${input.sentAt},
            version = version + 1,
            updated_at = now()
        where id = ${input.messageId}
          and status = 'pending_approval'
        returning engagement_id as "engagementId"
      `;
      return rows[0] ?? null;
    },

    async markNewsletterInvited(engagementId, invitedAt) {
      await db`
        update growth.delivery_engagements
        set newsletter_invited_at = ${invitedAt},
            updated_at = now()
        where id = ${engagementId} and newsletter_invited_at is null
      `;
    },
  };
}
