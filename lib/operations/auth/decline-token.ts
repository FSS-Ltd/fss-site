import { createHash, randomBytes } from "node:crypto";

export function hashDeclineToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function createDeclineToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashDeclineToken(token) };
}
