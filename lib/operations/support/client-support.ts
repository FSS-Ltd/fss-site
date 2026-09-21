import { z } from "zod";
import type { VerifiedPortalIdentity } from "../auth/types";
import type { OperationsDb } from "../db/client";
import { withPortalTransaction } from "../db/portal-client";

export const portalSupportRequestSchema = z.strictObject({
  category: z.enum([
    "project_question",
    "incident",
    "workspace_access",
    "billing",
    "other",
  ]),
  idempotencyKey: z.uuid(),
  message: z.string().trim().min(1).max(10000),
  subject: z.string().trim().min(1).max(160),
});

export type PortalSupportRequest = z.infer<typeof portalSupportRequestSchema>;
export type PortalSupportRequestReceipt = Readonly<{
  id: string;
  reference: string;
}>;

export function parsePortalSupportRequest(
  input: unknown,
): PortalSupportRequest {
  return portalSupportRequestSchema.parse(input);
}

export function supportRequestCreatesCharge(): false {
  return false;
}

export async function createPortalSupportRequest(
  db: OperationsDb,
  identity: VerifiedPortalIdentity | null,
  organisationId: string,
  correlationId: string,
  input: unknown,
): Promise<PortalSupportRequestReceipt> {
  const request = parsePortalSupportRequest(input);
  return withPortalTransaction(
    db,
    identity,
    organisationId,
    correlationId,
    async (tx) => {
      const [receipt] = await tx<PortalSupportRequestReceipt[]>`
        select * from operations.create_portal_support_request(
          ${organisationId}, ${request.category}, ${request.subject},
          ${request.message}, ${request.idempotencyKey}
        )
      `;
      if (!receipt) throw new Error("Support request receipt is unavailable.");
      return receipt;
    },
  );
}
