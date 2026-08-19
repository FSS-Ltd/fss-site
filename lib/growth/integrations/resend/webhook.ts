import { Webhook } from "svix";
import { z } from "zod";

import type { AuditInput } from "../../audit/service";
import type { StopSequenceInput, StoppedSequence } from "../../sequences/stop";
import { SequenceStopError } from "../../sequences/stop";
import type { EmailSuppressionDependencies } from "../../email/suppression";
import { recordComplaint, recordHardBounce } from "../../email/suppression";

const KNOWN_EVENT_DATA_SCHEMA = z
  .object({
    email_id: z.string().min(1),
    to: z.union([z.string().min(1), z.array(z.string().min(1)).min(1)]),
  })
  .passthrough();

const KNOWN_RESEND_EVENT_SCHEMA = z.discriminatedUnion("type", [
  z.object({ type: z.literal("email.sent"), created_at: z.string().min(1), data: KNOWN_EVENT_DATA_SCHEMA }),
  z.object({ type: z.literal("email.delivered"), created_at: z.string().min(1), data: KNOWN_EVENT_DATA_SCHEMA }),
  z.object({ type: z.literal("email.delivery_delayed"), created_at: z.string().min(1), data: KNOWN_EVENT_DATA_SCHEMA }),
  z.object({ type: z.literal("email.bounced"), created_at: z.string().min(1), data: KNOWN_EVENT_DATA_SCHEMA }),
  z.object({ type: z.literal("email.complained"), created_at: z.string().min(1), data: KNOWN_EVENT_DATA_SCHEMA }),
  z.object({ type: z.literal("email.opened"), created_at: z.string().min(1), data: KNOWN_EVENT_DATA_SCHEMA }),
  z.object({ type: z.literal("email.clicked"), created_at: z.string().min(1), data: KNOWN_EVENT_DATA_SCHEMA }),
]);

// Forward-compatible fallback so an event type Resend adds later is logged
// for audit/idempotency instead of crashing the webhook.
const GENERIC_RESEND_EVENT_SCHEMA = z.object({
  type: z.string().min(1),
  created_at: z.string().min(1),
  data: KNOWN_EVENT_DATA_SCHEMA,
});

const SUPPRESSING_EVENT_TYPES = new Set(["email.bounced", "email.complained"]);

export type ResendWebhookHeaders = {
  "svix-id": string | null;
  "svix-timestamp": string | null;
  "svix-signature": string | null;
};

export type VerifyResendWebhookResult =
  | { ok: true; payload: unknown; providerEventId: string }
  | { ok: false };

/** Verifies the raw request body against the Resend/Svix signature headers.
 * Never call before this; the caller must read the body as text (no JSON
 * parsing) so the exact bytes that were signed are what gets verified. */
export function verifyResendWebhookSignature(
  rawBody: string,
  headers: ResendWebhookHeaders,
  secret: string,
): VerifyResendWebhookResult {
  const svixId = headers["svix-id"];
  const svixTimestamp = headers["svix-timestamp"];
  const svixSignature = headers["svix-signature"];
  if (!svixId || !svixTimestamp || !svixSignature) {
    return { ok: false };
  }

  try {
    const payload = new Webhook(secret).verify(rawBody, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    });
    return { ok: true, payload, providerEventId: svixId };
  } catch {
    return { ok: false };
  }
}

export type ParsedResendWebhookEvent = {
  type: string;
  occurredAt: Date;
  providerMessageId: string;
  recipientNormalisedEmail: string;
};

export type ParseResendWebhookPayloadResult =
  | { ok: true; event: ParsedResendWebhookEvent }
  | { ok: false };

function firstRecipient(to: string | string[]): string {
  const value = Array.isArray(to) ? to[0] : to;
  return value.trim().toLowerCase();
}

export function parseResendWebhookPayload(payload: unknown): ParseResendWebhookPayloadResult {
  const known = KNOWN_RESEND_EVENT_SCHEMA.safeParse(payload);
  const parsed = known.success ? known : GENERIC_RESEND_EVENT_SCHEMA.safeParse(payload);
  if (!parsed.success) return { ok: false };

  const occurredAt = new Date(parsed.data.created_at);
  if (Number.isNaN(occurredAt.getTime())) return { ok: false };

  return {
    ok: true,
    event: {
      type: parsed.data.type,
      occurredAt,
      providerMessageId: parsed.data.data.email_id,
      recipientNormalisedEmail: firstRecipient(parsed.data.data.to),
    },
  };
}

export type ResendDeliveryEventInput = {
  providerEventId: string;
  eventType: string;
  occurredAt: Date;
  recipientNormalisedEmail: string;
  providerMessageId: string;
};

export type ResendWebhookRepository = {
  /** Inserts the event keyed by `providerEventId`. `inserted: false` means
   * the event was already applied (replay) and no side effects should run. */
  insertDeliveryEventIfNew(
    input: ResendDeliveryEventInput,
  ): Promise<{ inserted: boolean }>;
  findSequenceEnrollmentIdsByEmail(
    normalisedEmail: string,
  ): Promise<string[]>;
};

export type ResendWebhookDependencies = {
  repository: ResendWebhookRepository;
  suppression: EmailSuppressionDependencies;
  cancelQueuedSendsForEmail: (
    normalisedEmail: string,
    errorCode: string,
  ) => Promise<{ cancelledIssueIds: string[] }>;
  stopSequence: (input: StopSequenceInput) => Promise<StoppedSequence>;
  appendAuditEvent: (input: AuditInput) => Promise<void>;
  now?: () => Date;
};

function suppressionReasonForEventType(eventType: string): "bounce" | "do_not_contact" {
  return eventType === "email.bounced" ? "bounce" : "do_not_contact";
}

async function applySuppression(
  event: ParsedResendWebhookEvent,
  providerEventId: string,
  deps: ResendWebhookDependencies,
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const email = event.recipientNormalisedEmail;

  if (event.type === "email.bounced") {
    await recordHardBounce(email, deps.suppression, now);
  } else {
    await recordComplaint(email, deps.suppression, now);
  }

  await deps.cancelQueuedSendsForEmail(email, `resend_${event.type}`);

  const enrollmentIds = await deps.repository.findSequenceEnrollmentIdsByEmail(email);
  const reason = suppressionReasonForEventType(event.type);
  for (const sequenceId of enrollmentIds) {
    try {
      await deps.stopSequence({
        sequenceId,
        reason,
        actor: { type: "resend_webhook", id: providerEventId },
        correlationId: providerEventId,
      });
    } catch (error) {
      if (error instanceof SequenceStopError && error.code === "already_stopped") {
        continue;
      }
      throw error;
    }
  }

  await deps.appendAuditEvent({
    correlationId: providerEventId,
    actorType: "provider",
    actorId: "resend_webhook",
    action: `resend_webhook.${event.type}`,
    entityType: "newsletter_subscriber",
    entityId: email,
  });
}

export type ApplyResendWebhookEventResult = { duplicate: boolean };

/** Idempotent event application: inserts the delivery event row first, and
 * only runs suppression side effects for a genuinely new (non-replayed)
 * hard bounce or complaint event. */
export async function applyResendWebhookEvent(
  event: ParsedResendWebhookEvent,
  providerEventId: string,
  deps: ResendWebhookDependencies,
): Promise<ApplyResendWebhookEventResult> {
  const { inserted } = await deps.repository.insertDeliveryEventIfNew({
    providerEventId,
    eventType: event.type,
    occurredAt: event.occurredAt,
    recipientNormalisedEmail: event.recipientNormalisedEmail,
    providerMessageId: event.providerMessageId,
  });

  if (!inserted) return { duplicate: true };
  if (SUPPRESSING_EVENT_TYPES.has(event.type)) {
    await applySuppression(event, providerEventId, deps);
  }

  return { duplicate: false };
}

export type HandleResendWebhookInput = {
  rawBody: string;
  headers: ResendWebhookHeaders;
  secret: string | undefined;
};

export type HandleResendWebhookResult =
  | { status: "applied"; duplicate: boolean }
  | { status: "unauthorized" }
  | { status: "invalid_payload" };

export async function handleResendWebhook(
  input: HandleResendWebhookInput,
  deps: ResendWebhookDependencies,
): Promise<HandleResendWebhookResult> {
  if (!input.secret) return { status: "unauthorized" };

  const verified = verifyResendWebhookSignature(input.rawBody, input.headers, input.secret);
  if (!verified.ok) return { status: "unauthorized" };

  const parsed = parseResendWebhookPayload(verified.payload);
  if (!parsed.ok) return { status: "invalid_payload" };

  const result = await applyResendWebhookEvent(parsed.event, verified.providerEventId, deps);
  return { status: "applied", duplicate: result.duplicate };
}
