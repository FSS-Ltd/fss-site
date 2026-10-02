import { z } from "zod";
import { welcomeInputSchema } from "./approval-schema";
import { welcomeWorkspaceBindingSchema } from "./command-schema";
import { JourneyConflict, type JourneyActor } from "./command-types";
const email = z.strictObject({
  from: z.email(),
  replyTo: z.email(),
  to: z.email(),
  subject: z.string(),
  html: z.string(),
  text: z.string(),
});
const base = {
  actorId: z.string(),
  organisationId: z.uuid(),
  agreementId: z.uuid(),
  expectedVersion: z.number().int().positive(),
  expiresAt: z.number(),
  journeyId: z.uuid(),
  approvalId: z.uuid(),
};
const schema = z.discriminatedUnion("kind", [
  z.strictObject({
    ...base,
    kind: z.literal("welcome"),
    snapshot: welcomeInputSchema.extend({
      welcome: email,
      accessibleHtml: z.string(),
      pdfHash: z.string().regex(/^[a-f0-9]{64}$/),
    }),
    pdfBase64: z.string(),
    workspace: welcomeWorkspaceBindingSchema.optional(),
  }),
  z.strictObject({
    ...base,
    kind: z.literal("proposal"),
    expectedGeneration: z.number().int().positive(),
    expectedProposalApprovalId: z.uuid().nullable(),
    snapshot: z.strictObject({
      signingApprovalId: z.uuid(),
      approvalHash: z.string().regex(/^[a-f0-9]{64}$/),
      revision: z.number().int().positive(),
      signers: z.array(z.email()),
      access: z.array(
        z.strictObject({
          email: z.email(),
          role: z.enum(["owner", "contributor", "billing_contact", "viewer"]),
        }),
      ),
      emails: z.array(email),
      activationEmails: z.array(email),
      portalUrl: z.url(),
    }),
  }),
]);
export type PreviewEnvelope = z.infer<typeof schema>;
export function envelope(
  raw: unknown,
  actor: JourneyActor,
  organisationId: string,
  now: number,
): PreviewEnvelope {
  const parsed = schema.parse(raw);
  if (
    parsed.actorId !== actor.actorId ||
    parsed.organisationId !== organisationId ||
    parsed.expiresAt <= now
  )
    throw new JourneyConflict(
      "stale_preview",
      "This preview has expired or belongs to another session. Prepare it again.",
    );
  return parsed;
}
