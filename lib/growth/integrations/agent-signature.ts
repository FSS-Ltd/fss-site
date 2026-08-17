import { createHmac, timingSafeEqual } from "node:crypto";

export type AgentSignatureResult =
  | { ok: true }
  | {
      ok: false;
      code: "missing" | "key_mismatch" | "stale" | "invalid";
    };

export type VerifyAgentRequestInput = {
  rawBody: Uint8Array;
  keyId: string | null;
  timestamp: string | null;
  signature: string | null;
  now: Date;
  configuredKeyId: string;
  secret: string;
};

const MAX_CLOCK_DIFFERENCE_MS = 300_000;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/i;
const UNIX_SECONDS_PATTERN = /^\d+$/;

export function verifyAgentRequest({
  rawBody,
  keyId,
  timestamp,
  signature,
  now,
  configuredKeyId,
  secret,
}: VerifyAgentRequestInput): AgentSignatureResult {
  if (!keyId?.trim() || !timestamp?.trim() || !signature?.trim()) {
    return { ok: false, code: "missing" };
  }

  if (!secret.trim()) {
    return { ok: false, code: "invalid" };
  }

  if (keyId !== configuredKeyId) {
    return { ok: false, code: "key_mismatch" };
  }

  if (!UNIX_SECONDS_PATTERN.test(timestamp)) {
    return { ok: false, code: "invalid" };
  }

  const timestampSeconds = Number(timestamp);
  const requestTimeMs = timestampSeconds * 1000;
  const nowMs = now.getTime();
  if (!Number.isSafeInteger(timestampSeconds) || !Number.isFinite(nowMs)) {
    return { ok: false, code: "invalid" };
  }

  if (Math.abs(nowMs - requestTimeMs) > MAX_CLOCK_DIFFERENCE_MS) {
    return { ok: false, code: "stale" };
  }

  if (!SHA256_HEX_PATTERN.test(signature)) {
    return { ok: false, code: "invalid" };
  }

  const suppliedSignature = Buffer.from(signature, "hex");
  const expectedSignature = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(rawBody)
    .digest();

  if (!timingSafeEqual(suppliedSignature, expectedSignature)) {
    return { ok: false, code: "invalid" };
  }

  return { ok: true };
}
