import { createHmac, timingSafeEqual } from "node:crypto";
import { JourneyConflict } from "./command-types";
const domain = "fss-onboarding-founder-preview-v1";
export function signPreview(payload: object, key: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${createHmac("sha256", key).update(domain).update(body).digest("base64url")}`;
}
export function verifyPreview(token: string, key: Buffer): unknown {
  const [body, mac, extra] = token.split(".");
  const expected = createHmac("sha256", key)
    .update(domain)
    .update(body ?? "")
    .digest();
  const supplied = Buffer.from(mac ?? "", "base64url");
  if (
    !body ||
    extra ||
    supplied.length !== expected.length ||
    !timingSafeEqual(supplied, expected)
  )
    throw new JourneyConflict(
      "stale_preview",
      "This preview is invalid. Prepare it again before approving.",
    );
  try {
    return JSON.parse(Buffer.from(body, "base64url").toString());
  } catch {
    throw new JourneyConflict("stale_preview", "Prepare a new preview.");
  }
}
