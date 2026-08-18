import { createHmac, timingSafeEqual } from "node:crypto";

const SUPPRESSED_STATUSES = new Set(["unsubscribed", "bounced", "complained"]);
const UNSUBSCRIBE_TOKEN_PURPOSE = "newsletter-unsubscribe";
const UNSUBSCRIBE_TOKEN_TTL_SECONDS = 90 * 24 * 60 * 60;

export type SuppressibleStatus = "pending" | "subscribed" | "unsubscribed" | "bounced" | "complained";

export type EmailSuppressionDependencies = {
  findSubscriberStatusByEmail: (
    normalisedEmail: string,
  ) => Promise<{ status: SuppressibleStatus } | null>;
  upsertSuppressedStatus: (
    normalisedEmail: string,
    status: "bounced" | "complained",
    occurredAt: Date,
  ) => Promise<void>;
};

function normaliseEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * The single check every Resend send must pass before queueing and again
 * inside the dispatch transaction.
 */
export async function isSuppressed(
  email: string,
  dependencies: EmailSuppressionDependencies,
): Promise<boolean> {
  const record = await dependencies.findSubscriberStatusByEmail(normaliseEmail(email));
  return record !== null && SUPPRESSED_STATUSES.has(record.status);
}

export async function recordHardBounce(
  email: string,
  dependencies: EmailSuppressionDependencies,
  occurredAt: Date = new Date(),
): Promise<void> {
  await dependencies.upsertSuppressedStatus(normaliseEmail(email), "bounced", occurredAt);
}

export async function recordComplaint(
  email: string,
  dependencies: EmailSuppressionDependencies,
  occurredAt: Date = new Date(),
): Promise<void> {
  await dependencies.upsertSuppressedStatus(normaliseEmail(email), "complained", occurredAt);
}

type UnsubscribeTokenPayload = {
  purpose: typeof UNSUBSCRIBE_TOKEN_PURPOSE;
  email: string;
  exp: number;
};

function encodePayload(payload: UnsubscribeTokenPayload): string {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

export function signUnsubscribeToken(
  email: string,
  secret: string,
  now: Date = new Date(),
): string {
  const encodedPayload = encodePayload({
    purpose: UNSUBSCRIBE_TOKEN_PURPOSE,
    email: normaliseEmail(email),
    exp: Math.floor(now.getTime() / 1000) + UNSUBSCRIBE_TOKEN_TTL_SECONDS,
  });
  return `${encodedPayload}.${sign(encodedPayload, secret)}`;
}

export type VerifiedUnsubscribeToken =
  | { ok: true; normalisedEmail: string }
  | { ok: false; reason: "malformed" | "expired" | "invalid_signature" };

export function verifyUnsubscribeToken(
  token: string,
  secret: string,
  now: Date = new Date(),
): VerifiedUnsubscribeToken {
  const separatorIndex = token.lastIndexOf(".");
  if (separatorIndex <= 0 || separatorIndex === token.length - 1) {
    return { ok: false, reason: "malformed" };
  }

  const encodedPayload = token.slice(0, separatorIndex);
  const signature = token.slice(separatorIndex + 1);
  const expectedSignature = sign(encodedPayload, secret);
  const signatureBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  if (
    signatureBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(signatureBuffer, expectedBuffer)
  ) {
    return { ok: false, reason: "invalid_signature" };
  }

  let payload: Partial<UnsubscribeTokenPayload>;
  try {
    payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (
    payload.purpose !== UNSUBSCRIBE_TOKEN_PURPOSE ||
    typeof payload.email !== "string" ||
    !payload.email ||
    typeof payload.exp !== "number"
  ) {
    return { ok: false, reason: "malformed" };
  }

  if (Math.floor(now.getTime() / 1000) > payload.exp) {
    return { ok: false, reason: "expired" };
  }

  return { ok: true, normalisedEmail: payload.email };
}
