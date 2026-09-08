import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
const envelope = z.strictObject({
  version: z.literal(1),
  iv: z.string(),
  ciphertext: z.string(),
  tag: z.string(),
});
export type EncryptedInvite = z.infer<typeof envelope>;
export function parseInviteKey(raw: string | undefined): Buffer {
  if (!raw || !/^[A-Za-z0-9+/]{43}=$/.test(raw))
    throw new Error("Onboarding invitation encryption is not configured.");
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32 || key.toString("base64") !== raw)
    throw new Error("Onboarding invitation encryption is not configured.");
  return key;
}
function additionalData(jobId: string, recipient: string): Buffer {
  z.uuid().parse(jobId);
  z.email().parse(recipient);
  return Buffer.from(
    `fss:operations:onboarding:invite:v1:${jobId}:${recipient.toLowerCase()}`,
  );
}
export function encryptInviteToken(
  token: string,
  key: Buffer,
  jobId: string,
  recipient: string,
): EncryptedInvite {
  z.string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .parse(token);
  if (key.length !== 32) throw new Error("Invalid invitation key.");
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(additionalData(jobId, recipient));
  const ciphertext = Buffer.concat([
    cipher.update(token, "utf8"),
    cipher.final(),
  ]);
  return {
    version: 1,
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
  };
}
export function decryptInviteToken(
  raw: unknown,
  key: Buffer,
  jobId: string,
  recipient: string,
): string {
  const value = envelope.parse(raw);
  const iv = Buffer.from(value.iv, "base64");
  const tag = Buffer.from(value.tag, "base64");
  const ciphertext = Buffer.from(value.ciphertext, "base64");
  if (
    key.length !== 32 ||
    iv.length !== 12 ||
    tag.length !== 16 ||
    ciphertext.length !== 43
  )
    throw new Error("Invalid invitation envelope.");
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAAD(additionalData(jobId, recipient));
  decipher.setAuthTag(tag);
  const token = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8");
  return z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .parse(token);
}
