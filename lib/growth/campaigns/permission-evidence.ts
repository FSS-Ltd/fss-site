import { z } from "zod";
import { isPublicHttpUrl } from "../http/public-url";

export const evidenceReferenceSchema = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("public"),
    value: z
      .url()
      .refine(
        (value) =>
          isPublicHttpUrl(value) &&
          ![".internal", ".localhost", ".local", ".test"].some((suffix) =>
            new URL(value).hostname.toLowerCase().endsWith(suffix),
          ),
      ),
  }),
  z.strictObject({
    kind: z.literal("private"),
    value: z.string().trim().min(1).max(500),
  }),
]);

export const requestedServiceSchema = z.strictObject({
  requestedAt: z.iso.datetime({ offset: true }),
  offerId: z.string().trim().min(1),
  messageScope: z.literal("initial_and_two_followups"),
  attestsRecipientRequest: z.literal(true),
});
export const permissionEvidenceSchema = z.object({
  observedAt: z.iso.datetime({ offset: true }),
  explicitOptIn: z.boolean(),
  summary: z.string().trim().min(1).max(2000),
  reference: evidenceReferenceSchema,
  requestedService: requestedServiceSchema.optional(),
});
export function isSupportedPermission(
  basis: string | null,
  provider: string,
  jurisdiction: string | null,
): boolean {
  return (
    basis === "consent" ||
    (basis === "requested_service" &&
      provider === "gmail" &&
      jurisdiction === "GB")
  );
}
export function validPermissionEvidence(input: {
  basis: string;
  provider: string;
  jurisdiction: string;
  offer: string | null;
  now: Date;
  evidence: unknown;
}): boolean {
  const parsed = permissionEvidenceSchema.safeParse(input.evidence);
  if (!parsed.success || new Date(parsed.data.observedAt) > input.now)
    return false;
  if (input.basis === "consent")
    return parsed.data.explicitOptIn && !parsed.data.requestedService;
  const request = parsed.data.requestedService;
  return (
    input.basis === "requested_service" &&
    isSupportedPermission(input.basis, input.provider, input.jurisdiction) &&
    !!input.offer &&
    !!request &&
    request.offerId === input.offer &&
    new Date(request.requestedAt) <= input.now &&
    new Date(request.requestedAt) <= new Date(parsed.data.observedAt)
  );
}
