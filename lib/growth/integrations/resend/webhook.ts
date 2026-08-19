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
    bounce: z.object({ type: z.string() }).partial().optional(),
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
  bounceType?: string;
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
      bounceType: parsed.data.data.bounce?.type,
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
  /** Pre-check used to gate the fan-out: true means this event was already
   * applied (replay) and no side effects should run. */
  hasDeliveryEvent(providerEventId: string): Promise<boolean>;
  /** Records the event keyed by `providerEventId`, called AFTER the
   * fan-out succeeds. `inserted: false` means a concurrent duplicate
   * delivery raced ahead and already recorded it — harmless, since the
   * fan-out it already ran is idempotent. */
  recordDeliveryEvent(
    input: ResendDeliveryEventInput,
  ): Promise<{ inserted: boolean }>;
  findSequenceEnrollmentIdsByEmail(
    normalisedEmail: string,
  ): Promise<string[]>;
  insertGlobalSuppression(input: {
    normalisedEmail: string;
    reason: "bounce" | "do_not_contact";
    source: string;
    createdBy: string;
  }): Promise<void>;
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

/** A `Permanent` bounce or a complaint permanently suppresses the address.
 * A `Transient`/`Undetermined`/missing-type bounce does not — it's still
 * recorded for idempotency, it just doesn't trigger the fan-out. */
function isSuppressingEvent(event: ParsedResendWebhookEvent): boolean {
  if (event.type === "email.complained") return true;
  if (event.type === "email.bounced") return event.bounceType === "Permanent";
  return false;
}

async function applySuppression(
  event: ParsedResendWebhookEvent,
  providerEventId: string,
  deps: ResendWebhookDependencies,
): Promise<void> {
  const now = deps.now?.() ?? new Date();
  const email = event.recipientNormalisedEmail;
  const reason = suppressionReasonForEventType(event.type);

  if (event.type === "email.bounced") {
    await recordHardBounce(email, deps.suppression, now);
  } else {
    await recordComplaint(email, deps.suppression, now);
  }

  await deps.cancelQueuedSendsForEmail(email, `resend_${event.type}`);

  // Written unconditionally, independent of any matching Gmail enrollment —
  // this is what protects an address with no live sequence from a future
  // cold-outreach send (see dispatcher-repository.ts's isSuppressed).
  await deps.repository.insertGlobalSuppression({
    normalisedEmail: email,
    reason,
    source: "resend_webhook",
    createdBy: providerEventId,
  });

  const enrollmentIds = await deps.repository.findSequenceEnrollmentIdsByEmail(email);
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

/** Idempotent event application: checks first, runs the (already-idempotent)
 * suppression fan-out, and only records the delivery event last. This way a
 * mid-fan-out failure leaves the event unrecorded, so a Resend retry
 * re-attempts the fan-out instead of seeing it as already applied. */
export async function applyResendWebhookEvent(
  event: ParsedResendWebhookEvent,
  providerEventId: string,
  deps: ResendWebhookDependencies,
): Promise<ApplyResendWebhookEventResult> {
  if (await deps.repository.hasDeliveryEvent(providerEventId)) {
    return { duplicate: true };
  }

  if (isSuppressingEvent(event)) {
    await applySuppression(event, providerEventId, deps);
  }

  await deps.repository.recordDeliveryEvent({
    providerEventId,
    eventType: event.type,
    occurredAt: event.occurredAt,
    recipientNormalisedEmail: event.recipientNormalisedEmail,
    providerMessageId: event.providerMessageId,
  });

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
