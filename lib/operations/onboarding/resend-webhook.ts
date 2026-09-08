import { z } from "zod";
import type { OperationsDb } from "../db/client";
import { verifyResendWebhookSignature } from "../../growth/integrations/resend/webhook";
import { readWebhookBytes, WebhookBodyTooLarge } from "../http/webhook-body";
import { recordOnboardingDeliveryFailure } from "./repository";
const payloadSchema = z.object({
  type: z.enum(["email.bounced", "email.complained"]),
  data: z.object({
    email_id: z.string().min(1).max(300),
    from: z.string().max(320),
    to: z.array(z.email()).length(1),
    tags: z.object({ operations_job: z.uuid() }),
  }),
});
export async function applyOnboardingDeliveryEvent(
  db: OperationsDb,
  accountScope: string,
  eventId: string,
  payload: z.infer<typeof payloadSchema>,
): Promise<void> {
  const data = payload.data;
  const [job] = await db<
    { recipient: string; from: string; providerId: string | null }[]
  >`
 select b.recipient,a.snapshot->'welcome'->>'from' as "from",e.receipt->>'providerId' as "providerId"
 from operations.onboarding_jobs b join operations.onboarding_journeys j on j.id=b.journey_id join operations.onboarding_approvals a on a.id=j.approval_id join operations.onboarding_effects e on e.job_id=b.id
 where b.id=${data.tags.operations_job} and b.step in ('welcome','proposal','activation','thank_you') and b.first_attempt_at is not null`;
  if (
    !job ||
    job.recipient !== data.to[0].toLowerCase() ||
    job.from !== data.from ||
    (job.providerId !== null && job.providerId !== data.email_id)
  )
    return;
  await recordOnboardingDeliveryFailure(db, {
    accountScope,
    eventId,
    jobId: data.tags.operations_job,
    kind: payload.type === "email.bounced" ? "bounced" : "complained",
  });
}
export function createOnboardingWebhookHandler(deps: {
  enabled: boolean;
  configuration: () => { secret: string; accountScope: string };
  record: (
    accountScope: string,
    eventId: string,
    payload: z.infer<typeof payloadSchema>,
  ) => Promise<void>;
}): (request: Request) => Promise<Response> {
  return async (request) => {
    const reply = (status: number) =>
      Response.json(
        { ok: status === 200 },
        { status, headers: { "cache-control": "no-store" } },
      );
    if (!deps.enabled) return reply(404);
    if (
      request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
    )
      return reply(415);
    try {
      const config = deps.configuration();
      const raw = Buffer.from(await readWebhookBytes(request, 65536)).toString(
        "utf8",
      );
      const verified = verifyResendWebhookSignature(
        raw,
        {
          "svix-id": request.headers.get("svix-id"),
          "svix-timestamp": request.headers.get("svix-timestamp"),
          "svix-signature": request.headers.get("svix-signature"),
        },
        config.secret,
      );
      if (!verified.ok) return reply(400);
      const parsed = payloadSchema.safeParse(verified.payload);
      if (!parsed.success) return reply(200);
      await deps.record(
        config.accountScope,
        verified.providerEventId,
        parsed.data,
      );
      return reply(200);
    } catch (error) {
      return reply(error instanceof WebhookBodyTooLarge ? 413 : 503);
    }
  };
}
